import { ApiGatewayV2Client, GetApisCommand, CreateApiCommand, CreateIntegrationCommand, CreateRouteCommand, GetIntegrationsCommand, GetRoutesCommand, type Api } from '@aws-sdk/client-apigatewayv2';
import { AddPermissionCommand } from '@aws-sdk/client-lambda';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { lambdaClient } from './client';

/**
 * Public HTTPS entry for SSR sites while CloudFront is locked behind the
 * new-account verification gate: one HTTP API per project with a $default
 * proxy route → Lambda (Lambda Web Adapter consumes the v2 event natively).
 */

export function gatewayName(projectId: string) {
  return `openhost-${projectId}`.toLowerCase();
}

export async function ensureHttpGateway(
  creds: AwsCredentials,
  opts: { projectId: string; functionName: string }
): Promise<{ endpoint: string; apiId: string }> {
  const client = new ApiGatewayV2Client({ region: creds.region, credentials: creds });
  const name = gatewayName(opts.projectId);

  // Integration target resolved through STS (account id).
  const idRes = await new STSClient({ region: creds.region, credentials: creds }).send(
    new GetCallerIdentityCommand({})
  );
  const account = idRes.Account!;

  let api: Api | undefined;
  let nextToken: string | undefined;
  do {
    const page = await client.send(new GetApisCommand({ ...(nextToken ? { NextToken: nextToken } : {}) }));
    api = page.Items?.find((a: Api) => a.Name === name);
    nextToken = page.NextToken;
  } while (!api && nextToken);
  if (!api) {
    api = (await client.send(
      new CreateApiCommand({
        Name: name,
        ProtocolType: 'HTTP',
        Target: `arn:aws:apigateway:${creds.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${creds.region}:${account}:function:${opts.functionName}/invocations`,
        Tags: { ...OPENHOST_STACK_TAGS },
      })
    )) as Api;
  }
  if (!api?.ApiId) throw new Error('Could not create the API Gateway HTTP API');

  // If the API pre-existed with no $default route/integration, add them now.
  const apiId = api.ApiId;
  const routes =
    (await client.send(new GetRoutesCommand({ ApiId: apiId })).catch(() => ({ Items: [] })))
      .Items ?? [];
  const hasDefault = routes.some((r) => r.RouteKey === '$default');
  if (!hasDefault) {
    const integrations =
      (await client.send(new GetIntegrationsCommand({ ApiId: apiId })).catch(() => ({ Items: [] })))
        .Items ?? [];
    let integrationId = integrations[0]?.IntegrationId;
    if (!integrationId) {
      integrationId = (
        await client.send(
          new CreateIntegrationCommand({
            ApiId: apiId,
            IntegrationType: 'AWS_PROXY',
            IntegrationUri: `arn:aws:apigateway:${creds.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${creds.region}:${account}:function:${opts.functionName}/invocations`,
          })
        )
      ).IntegrationId;
      await client.send(
        new CreateRouteCommand({
          ApiId: apiId,
          RouteKey: '$default',
          Target: `integrations/${integrationId}`,
        })
      );
    }
  }

  // Lambda invoke permission for the gateway (idempotent per API id).
  const sourceArn = `arn:aws:execute-api:${creds.region}:${account}:${apiId}/*`;
  try {
    await lambdaClient(creds).send(
      new AddPermissionCommand({
        FunctionName: opts.functionName,
        StatementId: `openhost-apigw-${apiId}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: sourceArn,
      })
    );
  } catch {
    /* statement already present */
  }

  return { endpoint: String(api.ApiEndpoint ?? ''), apiId };
}
