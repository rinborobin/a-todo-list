import type { StudyRating, SubjectKind } from "@/db/schema";
import { formatDuration } from "@/lib/format";
import { KIND_LABEL, RATING_LABEL } from "@/lib/study/labels";

export interface SubjectMeterRow {
  key: string;
  name: string;
  /** Null for time logged without a subject. */
  kind: SubjectKind | null;
  minutes7d: number;
  daysSince: number | null;
  latestRating: StudyRating | null;
  /** Kind-specific progress: "Lesson 18 of 40 · 3 of 5 days this week", "MVP 4/7 tasks". */
  detail: string | null;
}

function lastStudied(days: number | null, kind: SubjectKind | null) {
  const verb = kind === "PROJECT" ? "Worked on" : "Studied";
  if (days === null) return kind === "PROJECT" ? "Not started yet" : "Not studied yet";
  if (days === 0) return `${verb} today`;
  if (days === 1) return `${verb} yesterday`;
  return `Last ${verb.toLowerCase()} ${days} days ago`;
}

/**
 * One row per item: name, a bar on a shared scale, and the exact figure.
 * The bar drops under the name on narrow screens.
 */
export function SubjectMeters({ rows }: { rows: SubjectMeterRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes7d));

  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_4.5rem] sm:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.name}</p>
            <p className="text-[13px] text-muted">
              {[
                row.kind ? KIND_LABEL[row.kind] : null,
                lastStudied(row.daysSince, row.kind),
                row.kind !== "PROJECT" && row.latestRating ? RATING_LABEL[row.latestRating] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {row.detail && <p className="text-[13px] text-ink-soft">{row.detail}</p>}
          </div>
          <p className="tabular text-right text-[15px] sm:order-last">
            {row.minutes7d > 0 ? formatDuration(row.minutes7d) : <span className="text-faint">0m</span>}
          </p>
          <div className="col-span-2 h-2 rounded-full bg-line sm:col-span-1" aria-hidden="true">
            {row.minutes7d > 0 && (
              <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, (row.minutes7d / max) * 100)}%` }} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
