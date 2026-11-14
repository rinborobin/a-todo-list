import { formatDuration } from "@/lib/format";

interface DailyStripProps {
  days: { date: string; minutes: number }[];
  today: string;
}

function dayParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
  return { initial: fmt({ weekday: "narrow" }), full: fmt({ weekday: "short", day: "numeric", month: "short" }) };
}

/**
 * Minutes studied per day as columns on a shared baseline. Single series, so
 * no legend; each column reveals its exact value on hover or focus, and the
 * values are also available to screen readers as a list.
 */
export function DailyStrip({ days, today }: DailyStripProps) {
  const max = Math.max(60, ...days.map((d) => d.minutes));

  return (
    <figure>
      <figcaption className="sr-only">Minutes studied per day, last 7 days</figcaption>
      <ol className="flex h-24 items-end gap-0.5 border-b border-line-strong">
        {days.map((day, index) => {
          const { full } = dayParts(day.date);
          const label = `${full}: ${day.minutes > 0 ? formatDuration(day.minutes) : "nothing"}`;
          return (
            <li
              key={day.date}
              tabIndex={0}
              aria-label={label}
              className="group relative flex h-full flex-1 items-end justify-center rounded-sm"
            >
              {/* Hit area is the whole column; the mark itself stays thin. */}
              <span
                aria-hidden="true"
                className={`grow-y w-full max-w-7 rounded-t-[4px] transition-opacity ${
                  day.minutes > 0 ? "bg-ink group-hover:opacity-80" : "bg-line-strong"
                }`}
                style={
                  {
                    height: day.minutes > 0 ? `${Math.max(4, (day.minutes / max) * 100)}%` : "2px",
                    "--i": index,
                  } as React.CSSProperties
                }
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full mb-1.5 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-paper group-hover:block group-focus-visible:block"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="mt-1.5 flex gap-0.5">
        {days.map((day) => (
          <li
            key={day.date}
            className={`flex-1 text-center text-[11px] ${day.date === today ? "font-semibold text-ink" : "text-faint"}`}
          >
            {dayParts(day.date).initial}
          </li>
        ))}
      </ol>
    </figure>
  );
}
