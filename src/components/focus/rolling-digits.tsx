"use client";

import { useState } from "react";

type Direction = "up" | "down";

interface SlotItem {
  id: number;
  char: string;
  leaving: boolean;
}

/**
 * One character position. When its character changes, the old one rolls out
 * and the new one rolls in; unchanged positions do not move at all.
 */
function Slot({ char, direction }: { char: string; direction: Direction }) {
  const [items, setItems] = useState<SlotItem[]>([{ id: 0, char, leaving: false }]);
  const [shown, setShown] = useState(char);

  // Adjust state while rendering when the prop changes (React's recommended
  // pattern for derived state), so no effect or extra render pass is needed.
  if (char !== shown) {
    setShown(char);
    setItems((prev) => {
      const current = prev.filter((item) => !item.leaving);
      const nextId = (prev[prev.length - 1]?.id ?? 0) + 1;
      return [...current.map((item) => ({ ...item, leaving: true })), { id: nextId, char, leaving: false }];
    });
  }

  const isSeparator = char === ":" || char === "+";

  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1.08em] overflow-hidden text-center"
      style={{ width: isSeparator ? "0.3em" : "0.58em" }}
    >
      {items.map((item) => (
        <span
          key={item.id}
          className={`absolute inset-x-0 top-0 ${
            item.leaving ? `digit-out-${direction}` : item.id === 0 ? "" : `digit-in-${direction}`
          }`}
          onAnimationEnd={
            item.leaving ? () => setItems((prev) => prev.filter((other) => other.id !== item.id)) : undefined
          }
        >
          {item.char}
        </span>
      ))}
    </span>
  );
}

interface RollingDigitsProps {
  text: string;
  direction: Direction;
  /** Read-out for screen readers; the animated characters are hidden from them. */
  label: string;
  className?: string;
}

/** A clock whose changing digits roll like a mechanical counter. */
export function RollingDigits({ text, direction, label, className = "" }: RollingDigitsProps) {
  const chars = [...text];
  return (
    <span className={`inline-flex tabular ${className}`}>
      <span className="sr-only">{label}</span>
      {chars.map((char, index) => (
        // Keyed from the right so seconds stay in the same slot when hours appear.
        <Slot key={`${chars.length - index}`} char={char} direction={direction} />
      ))}
    </span>
  );
}
