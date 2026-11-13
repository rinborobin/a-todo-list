import { getPlansForRangeQuery } from "@/actions/planner";
import { getUserTimezoneQuery } from "@/actions/availability";
import { listSubjectsQuery, listTopicsQuery } from "@/actions/study";
import { toRailSubjects } from "@/components/planner/rail-subjects";
import { WeekView } from "@/components/planner/week-view";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";

export const metadata = {
  title: "Week",
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const [{ start }, timezone, topics, subjects] = await Promise.all([
    searchParams,
    getUserTimezoneQuery(),
    listTopicsQuery(),
    listSubjectsQuery(),
  ]);
  const today = toLocalDateKey(new Date(), timezone);
  const startDate = start && DATE_KEY.test(start) ? start : today;
  const endDate = addDaysToDateKey(startDate, 6);
  const plansResult = await getPlansForRangeQuery(startDate, endDate);

  return (
    <WeekView
      plans={plansResult.success ? plansResult.data : []}
      loadError={plansResult.success ? null : plansResult.error}
      timezone={timezone}
      today={today}
      startDate={startDate}
      endDate={endDate}
      now={new Date()}
      topics={topics.filter((t) => !t.archivedAt).map(({ id, name, subjectId }) => ({ id, name, subjectId }))}
      subjects={toRailSubjects(subjects)}
    />
  );
}
