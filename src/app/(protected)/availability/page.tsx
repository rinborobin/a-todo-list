import { requireAuth } from "@/lib/session";
import { getUserAvailabilityQuery, getUserTimezoneQuery } from "@/actions/availability";
import { AvailabilityManager } from "@/components/availability/availability-manager";

export const metadata = {
  title: "Availability",
  description: "Manage your weekly availability and timezone.",
};

export default async function AvailabilityPage() {
  await requireAuth("/availability");
  const blocks = await getUserAvailabilityQuery();
  const timezone = await getUserTimezoneQuery();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Weekly Availability
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Set your recurring weekly hours. The planner will use these windows to schedule tasks.
        </p>
      </div>

      <AvailabilityManager initialBlocks={blocks} initialTimezone={timezone} />
    </main>
  );
}
