import type { Learned, ReviewItem } from "@/lib/study/learned";
import { formatDuration } from "@/lib/format";

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

function dueLabel(item: ReviewItem): { text: string; urgent: boolean } {
  if (item.overdueDays > 0) {
    return { text: `overdue ${item.overdueDays} day${item.overdueDays > 1 ? "s" : ""}`, urgent: true };
  }
  if (item.dueInDays === 0) return { text: "today", urgent: true };
  if (item.dueInDays === 1) return { text: "tomorrow", urgent: false };
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(
    new Date(`${item.nextReviewOn}T12:00:00Z`)
  );
  return { text: weekday, urgent: false };
}

function hoursText(hours: number[]) {
  const labels = hours.map((h) => `${String(h).padStart(2, "0")}:00`);
  return labels.length === 1 ? `around ${labels[0]}` : `around ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function idleText(days: number | null) {
  if (days === null) return "not started";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function estimateText(ratio: number) {
  if (ratio >= 1.05) return `Tasks take about ${Math.round((ratio - 1) * 100)}% longer than you estimate.`;
  if (ratio <= 0.95) return `Tasks take about ${Math.round((1 - ratio) * 100)}% less time than you estimate.`;
  return "Your time estimates are about right.";
}

/** Shows what the model believes, so suggestions are never a black box. */
export function LearnedSection({ learned }: { learned: Learned }) {
  return (
    <section aria-labelledby="learned-heading">
      <h2 id="learned-heading" className={`${sectionTitle} mb-2`}>
        What the app has learned
      </h2>

      {learned.sessionsCount < 3 ? (
        <p className="text-sm text-muted">
          It starts learning after a few sessions. Rate them and note the topic you covered, and suggestions get more
          specific.
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-1 font-serif text-lg">Up for review</h3>
            {learned.reviewQueue.length === 0 ? (
              <p className="text-sm text-muted">Nothing due this week.</p>
            ) : (
              <ul className="divide-y divide-line">
                {learned.reviewQueue.map((item) => {
                  const due = dueLabel(item);
                  return (
                    <li key={item.key} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]">
                          <span className="font-medium">{item.subjectName}</span>
                          {item.topicName && <span> · {item.topicName}</span>}
                        </span>
                        {item.lastRating === "STRUGGLED" && (
                          <span className="text-[13px] text-muted">felt hard last time</span>
                        )}
                      </span>
                      <span className={`shrink-0 text-[13px] ${due.urgent ? "font-medium text-accent" : "text-muted"}`}>
                        {due.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <dl className="divide-y divide-line border-y border-line text-[15px]">
            {learned.usualHours.length > 0 && (
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted">You usually study</dt>
                <dd>{hoursText(learned.usualHours)}</dd>
              </div>
            )}
            {learned.typicalBySubject.length > 0 && (
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted">Typical session</dt>
                <dd>
                  {learned.typicalBySubject.map((row, i) => (
                    <span key={row.subjectName}>
                      {i > 0 && <span className="text-faint"> · </span>}
                      {row.subjectName} {formatDuration(row.minutes)}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {learned.practice.length > 0 && (
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted">Practice</dt>
                <dd>
                  {learned.practice.map((row, i) => (
                    <span key={row.subjectName}>
                      {i > 0 && <span className="text-faint"> · </span>}
                      {row.subjectName} {row.line}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {learned.projects.length > 0 && (
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted">Projects last touched</dt>
                <dd>
                  {learned.projects.map((row, i) => (
                    <span key={row.subjectName}>
                      {i > 0 && <span className="text-faint"> · </span>}
                      {row.subjectName}{" "}
                      <span className={row.idleDays !== null && row.idleDays >= 5 ? "text-accent" : ""}>
                        {idleText(row.idleDays)}
                      </span>
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {learned.estimateRatio !== null && (
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted">Your estimates</dt>
                <dd>{estimateText(learned.estimateRatio)}</dd>
              </div>
            )}
            {learned.usualHours.length === 0 &&
              learned.typicalBySubject.length === 0 &&
              learned.practice.length === 0 &&
              learned.projects.length === 0 &&
              learned.estimateRatio === null && (
                <div className="py-2.5 text-sm text-muted">
                  Habits show up after a few timed sessions and finished tasks.
                </div>
              )}
          </dl>
        </div>
      )}
    </section>
  );
}
