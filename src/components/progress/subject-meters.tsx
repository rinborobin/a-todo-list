import type { StudyRating } from "@/db/schema";
import { formatDuration } from "@/lib/format";
import { RATING_LABEL } from "@/lib/study/labels";

export interface SubjectMeterRow {
  key: string;
  name: string;
  minutes7d: number;
  daysSince: number | null;
  latestRating: StudyRating | null;
}

function lastStudied(days: number | null) {
  if (days === null) return "Not studied yet";
  if (days === 0) return "Studied today";
  if (days === 1) return "Studied yesterday";
  return `Last studied ${days} days ago`;
}

/**
 * One row per subject: name, a bar on a shared scale, and the exact figure.
 * The bar drops under the name on narrow screens.
 */
export function SubjectMeters({ rows }: { rows: SubjectMeterRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes7d));

  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_4.5rem] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.name}</p>
            <p className="text-[13px] text-muted">
              {lastStudied(row.daysSince)}
              {row.latestRating && ` · ${RATING_LABEL[row.latestRating]}`}
            </p>
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
