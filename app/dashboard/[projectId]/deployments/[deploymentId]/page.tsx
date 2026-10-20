import { DeployLog } from '@/components/dashboard/deploy-log';

/** Live deploy progress page — Vercel-style streaming build log. */
export default function DeploymentPage({
  params,
}: {
  params: { projectId: string; deploymentId: string };
}) {
  return (
    <DeployLog
      projectId={params.projectId}
      projectTitle="Back to project"
      deploymentId={params.deploymentId}
    />
  );
}
