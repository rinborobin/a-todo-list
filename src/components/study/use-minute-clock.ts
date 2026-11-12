"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed every minute. Starts from a server-provided value so
 * the first client render matches the server markup.
 */
export function useMinuteClock(initial: Date): Date {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
