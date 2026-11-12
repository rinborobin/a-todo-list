import { getUserAvailabilityQuery, getUserTimezoneQuery } from "@/actions/availability";
import { listSubjectsQuery } from "@/actions/study";
import { SetupFlow } from "@/components/study/setup-flow";
import { toLocalDateKey } from "@/lib/scheduling/timezone";

export const metadata = {
  title: "Set up",
};

export default async function SetupPage() {
  const [subjects, availability, timezone] = await Promise.all([
    listSubjectsQuery(),
    getUserAvailabilityQuery(),
    getUserTimezoneQuery(),
  ]);

  return (
    <SetupFlow
      initialSubjects={subjects
        .filter((s) => !s.archivedAt)
        .map(({ id, name, confidence, examDate, weeklyGoalMinutes }) => ({
          id,
          name,
          confidence,
          examDate,
          weeklyGoalMinutes,
        }))}
      hasAvailability={availability.length > 0}
      today={toLocalDateKey(new Date(), timezone)}
    />
  );
}
