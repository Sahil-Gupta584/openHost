/**
 * AWS wrapper barrel. Consume from here, not from individual modules —
 * this keeps the SDK surface swappable and makes imports readable:
 *
 *   import { deployStaticAssets, ensureDistribution } from '@/lib/aws';
 */

export { resolveCredentials, DEFAULT_REGION, type AwsCredentials } from './config';
export { verifyCallerIdentity } from './client';
export {
  assetsBucketName,
  bucketExists,
  ensureBucket,
  deployStaticAssets,
  purgePrefix,
  deleteBucket,
  type UploadAssetsResult,
} from './s3';
export {
  siteFunctionName,
  functionExists,
  deploySiteFunction,
  deleteSiteFunction,
} from './lambda';
export {
  cfComment,
  getDistributionByProject,
  ensureDistribution,
  invalidatePaths,
  waitForInvalidation,
} from './cloudfront';
export {
  builderName,
  ensureBuilder,
  startBuilderRun,
  waitForCodeBuild,
  deleteBuilder,
  type CodeBuildOutcome,
} from './codebuild';
export { codeBuildRoleArn } from './iam';
export {
  requestCertificate,
  certificateStatus,
  findHostedZone,
  pointDomainAtDistribution,
  removeDomainRecord,
  type CertificateStatus,
} from './domains';
