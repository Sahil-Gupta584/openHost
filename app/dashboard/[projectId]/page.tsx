import { ProjectDetail } from '@/components/dashboard/project-detail';

export default function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <ProjectDetail projectId={params.projectId} />;
}
