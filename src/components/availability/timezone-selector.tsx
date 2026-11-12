"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Select } from "@/components/ui/field";

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

const subscribe = () => () => {};
const getDeviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimezone = () => null;

export function TimezoneSelector({ value, onChange, disabled = false }: TimezoneSelectorProps) {
  const timezones = useMemo(() => getSupportedTimezones(), []);
  // Read on the client only, so server and client markup match.
  const deviceTimezone = useSyncExternalStore(subscribe, getDeviceTimezone, getServerTimezone);

  return (
    <div>
      <label htmlFor="timezone" className="sr-only">
        Time zone
      </label>
      <Select id="timezone" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {!timezones.includes(value) && <option value={value}>{value}</option>}
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz.replaceAll("_", " ")}
          </option>
        ))}
      </Select>
      {deviceTimezone && deviceTimezone !== value && (
        <button
          type="button"
          onClick={() => onChange(deviceTimezone)}
          disabled={disabled}
          className="mt-2 text-sm text-accent underline-offset-4 hover:underline"
        >
          Use this device&apos;s time zone ({deviceTimezone.replaceAll("_", " ")})
        </button>
      )}
    </div>
  );
}
