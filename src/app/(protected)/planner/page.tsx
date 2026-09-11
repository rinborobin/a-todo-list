import { requireAuth } from "@/lib/session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPlansForRangeQuery } from "@/actions/planner";
import { PlannerControls } from "@/components/planner/planner-controls";
import { PlanView } from "@/components/planner/plan-view";

export const metadata = {
  title: "Planner",
  description: "Generate and view your daily schedule.",
};

function getWeekRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 6);

  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return { startDate: format(start), endDate: format(end) };
}

export default async function PlannerPage() {
  const session = await requireAuth("/planner");
  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { timezone: true },
  });
  const timezone = userRecord?.timezone ?? "UTC";

  const { startDate, endDate } = getWeekRange();
  const plansResult = await getPlansForRangeQuery(startDate, endDate);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Daily Planner
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Generate a deterministic schedule from your tasks and availability.
        </p>
      </div>

      <div className="mb-8">
        <PlannerControls />
      </div>

      {plansResult.success ? (
        <PlanView plans={plansResult.data} timezone={timezone} />
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          {plansResult.error}
        </p>
      )}
    </main>
  );
}
