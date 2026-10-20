import {
  ListHostedZonesCommand,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
} from '@aws-sdk/client-route-53';
import {
  RequestCertificateCommand,
  DescribeCertificateCommand,
} from '@aws-sdk/client-acm';
import type { AwsCredentials } from './config';
import { acmClientForCloudFront, route53Client } from './client';

/**
 * Custom domains per project:
 *  1. Request + validate an ACM cert (DNS-validated) in us-east-1.
 *  2. User adds validation CNAME in their DNS (or directly on their Route 53 zone).
 *  3. Once issued, create the A/AAAA alias records pointing at CloudFront.
 */

export async function requestCertificate(creds: AwsCredentials, domain: string) {
  const acm = acmClientForCloudFront(creds);
  const res = await acm.send(
    new RequestCertificateCommand({
      DomainName: domain,
      SubjectAlternativeNames: [domain, `*.${domain.replace(/^[^.]+\./, '')}`],
      // DNS validation so Route 53 can auto-write the records.
      ValidationMethod: 'DNS',
    })
  );

  return {
    certificateArn: res.CertificateArn!,
    validationRecords: await describeCertificateRecords(creds, res.CertificateArn!),
  };
}

export async function describeCertificateRecords(creds: AwsCredentials, arn: string) {
  const acm = acmClientForCloudFront(creds);
  const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: arn }));
  const options = res.Certificate!.DomainValidationOptions ?? [];

  return options.map((o) => ({
    domain: o.DomainName as string,
    cnameName: o.ResourceRecord?.Name as string,
    cnameValue: o.ResourceRecord?.Value as string,
  }));
}

export type CertificateStatus =
  | 'PENDING_VALIDATION'
  | 'ISSUED'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'INAPPROPRIATE_FOR_SIGNING'
  | 'SIMPLE_VALIDATION_EXISTS'
  | 'SUCCESSFULLY_REVOKED'
  | 'EXPIRING_SOON';

export async function certificateStatus(creds: AwsCredentials, arn: string) {
  const acm = acmClientForCloudFront(creds);
  const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: arn }));
  return {
    status: res.Certificate!.Status as CertificateStatus,
    issuedAt: res.Certificate!.IssuedAt,
    domainName: res.Certificate!.DomainName as string,
  };
}

/** Find the hosted zone with the best suffix match for a domain. */
export async function findHostedZone(creds: AwsCredentials, domain: string) {
  const r53 = route53Client(creds);
  const res = await r53.send(new ListHostedZonesCommand({}));

  const zones = (res.HostedZones ?? [])
    .filter((z) => z.Config?.PrivateZone === false)
    .map((z) => ({ id: z.Id!, name: z.Name!.replace(/\.$/, '') }))
    .sort((a, b) => b.name.length - a.name.length); // most specific first

  return zones.find((z) => domain === z.name || domain.endsWith(`.${z.name}`)) ?? null;
}

export async function pointDomainAtDistribution(
  creds: AwsCredentials,
  domain: string,
  distributionDomain: string
) {
  const zone = await findHostedZone(creds, domain);
  if (!zone) {
    return {
      delegated: false as const,
      message: `Hosted zone not found for ${domain}. Add the CNAME in your own DNS provider.`,
      cnameTarget: distributionDomain,
    };
  }

  const r53 = route53Client(creds);
  const zoneId = zone.id.replace('/hostedzone/', '');

  // Detect whether an existing record might conflict; change with UPSERT only for alias-safe flows.
  const existing = await r53.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      StartRecordName: domain,
      MaxItems: 1,
      StartRecordType: 'A',
    })
  );

  const alreadyAlias =
    existing.ResourceRecordSets?.[0]?.AliasTarget?.DNSName === `${distributionDomain}.`;

  if (alreadyAlias) return { delegated: true as const, changed: false as const, zoneId };

  // Split-horizon: A (alias) covers apex and subdomain both.
  await r53.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Comment: 'openhost custom domain',
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: domain,
              Type: 'A',
              AliasTarget: {
                HostedZoneId: 'Z2FDTNDATAQYM2', // fixed CloudFront zone
                DNSName: distributionDomain,
                EvaluateTargetHealth: false,
              },
            },
          },
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: domain,
              Type: 'AAAA',
              AliasTarget: {
                HostedZoneId: 'Z2FDTNDATAQYM2', // fixed CloudFront zone
                DNSName: distributionDomain,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    })
  );

  return { delegated: true as const, changed: true as const, zoneId };
}

export async function removeDomainRecord(creds: AwsCredentials, domain: string) {
  const zone = await findHostedZone(creds, domain);
  if (!zone) return { removed: false as const };

  const r53 = route53Client(creds);
  const zoneId = zone.id.replace('/hostedzone/', '');
  const res = await r53.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      StartRecordName: domain,
      MaxItems: 5,
    })
  );

  const toDelete = (res.ResourceRecordSets ?? []).filter(
    (rs) =>
      rs.Name?.replace(/\.$/, '') === domain &&
      (rs.Type === 'A' || rs.Type === 'AAAA' || rs.Type === 'CNAME')
  );

  if (!toDelete.length) return { removed: false as const };

  await r53.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Comment: 'openhost custom domain removal',
        Changes: toDelete.map((rs) => ({
          Action: 'DELETE',
          ResourceRecordSet: rs,
        })),
      },
    })
  );

  return { removed: true as const, deleted: toDelete.length };
}
