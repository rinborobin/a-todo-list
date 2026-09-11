"use client";

import { useMemo } from "react";
import { GlobeIcon } from "@/components/ui/icons";

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

function getSupportedTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export function TimezoneSelector({ value, onChange, disabled = false }: TimezoneSelectorProps) {
  const timezones = useMemo(() => getSupportedTimezones(), []);

  return (
    <div className="flex items-center gap-2">
      <GlobeIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
      <label htmlFor="timezone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Timezone
      </label>
      <select
        id="timezone"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
    </div>
  );
}
