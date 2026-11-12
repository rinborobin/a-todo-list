import { getTodayQuery } from "@/actions/planner";
import { TodayView } from "@/components/today/today-view";

export const metadata = {
  title: "Today",
};

export default async function TodayPage() {
  const data = await getTodayQuery();
  return <TodayView data={data} initialNow={new Date()} />;
}
