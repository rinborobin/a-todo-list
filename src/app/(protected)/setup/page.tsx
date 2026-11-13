import { getUserAvailabilityQuery, getUserTimezoneQuery } from "@/actions/availability";
import { listMilestonesQuery, listSubjectsQuery } from "@/actions/study";
import { SetupFlow } from "@/components/study/setup-flow";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { toSetupSubject } from "@/components/study/setup-subject";

export const metadata = {
  title: "Set up",
};

export default async function SetupPage() {
  const [subjects, milestones, availability, timezone] = await Promise.all([
    listSubjectsQuery(),
    listMilestonesQuery(),
    getUserAvailabilityQuery(),
    getUserTimezoneQuery(),
  ]);

  return (
    <SetupFlow
      initialSubjects={subjects
        .filter((s) => !s.archivedAt)
        .map(toSetupSubject)}
      milestones={milestones}
      hasAvailability={availability.length > 0}
      today={toLocalDateKey(new Date(), timezone)}
    />
  );
}
