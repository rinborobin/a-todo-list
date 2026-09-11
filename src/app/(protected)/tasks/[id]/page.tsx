import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/session";
import { getTaskByIdAction } from "@/actions/tasks";
import { TaskDetailPageClient } from "@/components/tasks/task-detail-page-client";

export const metadata = {
  title: "Task Details",
  description: "View task details",
};

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  await requireAuth();
  const { id } = await params;
  const result = await getTaskByIdAction(id);

  if (!result.success) {
    notFound();
  }

  return <TaskDetailPageClient task={result.data} />;
}
