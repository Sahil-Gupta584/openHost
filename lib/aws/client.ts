import { S3Client } from '@aws-sdk/client-s3';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ACMClient } from '@aws-sdk/client-acm';
import { IAMClient } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import type { AwsCredentials } from './config';

const CLOUDFRONT_REGION = 'us-east-1'; // CloudFront + ACM for CloudFront are always us-east-1
const ROUTE53_REGION = 'us-east-1';
const IAM_REGION = 'us-east-1';

export function s3Client(creds: AwsCredentials): S3Client {
  return new S3Client({ region: creds.region, credentials: creds });
}

export function lambdaClient(creds: AwsCredentials): LambdaClient {
  return new LambdaClient({ region: creds.region, credentials: creds });
}

export function cloudFrontClient(creds: AwsCredentials): CloudFrontClient {
  return new CloudFrontClient({
    region: CLOUDFRONT_REGION,
    credentials: creds,
  });
}

export function route53Client(creds: AwsCredentials): Route53Client {
  return new Route53Client({ region: ROUTE53_REGION, credentials: creds });
}

/** ACM used for CloudFront must be in us-east-1. */
export function acmClientForCloudFront(creds: AwsCredentials): ACMClient {
  return new ACMClient({ region: CLOUDFRONT_REGION, credentials: creds });
}

/** ACM used for regional resources (e.g. ALBs) lives in the app region. */
export function acmRegionalClient(creds: AwsCredentials): ACMClient {
  return new ACMClient({ region: creds.region, credentials: creds });
}

export function iamClient(creds: AwsCredentials): IAMClient {
  return new IAMClient({ region: IAM_REGION, credentials: creds });
}

export function stsClient(creds: AwsCredentials): STSClient {
  return new STSClient({ region: creds.region, credentials: creds });
}

export async function verifyCallerIdentity(creds: AwsCredentials) {
  const sts = stsClient(creds);
  const { Arn, Account } = await sts.send(new GetCallerIdentityCommand({}));
  return { arn: Arn, account: Account };
}
