import { notFound } from "next/navigation";
import { getTaskByIdAction } from "@/actions/tasks";
import { getUserTimezoneQuery } from "@/actions/availability";
import { TaskDetailPageClient } from "@/components/tasks/task-detail-page-client";

export const metadata = {
  title: "Task",
};

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const [result, timezone] = await Promise.all([getTaskByIdAction(id), getUserTimezoneQuery()]);

  if (!result.success) {
    notFound();
  }

  return <TaskDetailPageClient task={result.data} timezone={timezone} now={new Date()} />;
}
