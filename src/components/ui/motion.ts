"use client";

import { useState } from "react";

/**
 * Ids present when the component first rendered. Anything not in it was added
 * since, so only items the person just added animate in, never the whole list
 * on page load.
 */
export function useAddedSince<T extends { id: string }>(items: T[]): (id: string) => boolean {
  const [initial] = useState(() => new Set(items.map((item) => item.id)));
  return (id) => !initial.has(id);
}

/** True once a value differs from what it was on first render (e.g. a task just ticked). */
export function useChangedSince<T>(value: T): boolean {
  const [initial] = useState(value);
  return value !== initial;
}
