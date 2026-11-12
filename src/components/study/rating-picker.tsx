"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateStudySessionAction } from "@/actions/study";
import type { StudyRating } from "@/db/schema";
import { RATING_LABEL } from "@/lib/study/labels";


const OPTIONS: StudyRating[] = ["STRUGGLED", "OK", "GOT_IT"];

interface RatingPickerProps {
  sessionId: string;
  value?: StudyRating | null;
  /** Show "How did it go?" and a Skip button; used right after a session ends. */
  prompt?: boolean;
  onDone?: () => void;
}

/** One tap to say how a study session went. Tapping the chosen value again clears it. */
export function RatingPicker({ sessionId, value = null, prompt = false, onDone }: RatingPickerProps) {
  const router = useRouter();
  const [rating, setRating] = useState<StudyRating | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const choose = (next: StudyRating) => {
    const newValue = rating === next ? null : next;
    const previous = rating;
    setRating(newValue);
    setError(null);
    startTransition(async () => {
      const result = await rateStudySessionAction({ id: sessionId, rating: newValue });
      if (!result.success) {
        setRating(previous);
        setError(result.error);
        return;
      }
      router.refresh();
      if (prompt) onDone?.();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {prompt && <span className="text-muted">How did it go?</span>}
      <div role="group" aria-label="How did it go?" className="flex gap-1">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={rating === option}
            disabled={isPending}
            onClick={() => choose(option)}
            className={`h-8 rounded-lg px-2.5 transition-colors ${
              rating === option ? "bg-ink text-paper" : "bg-line/60 text-ink-soft hover:bg-line"
            }`}
          >
            {RATING_LABEL[option]}
          </button>
        ))}
      </div>
      {prompt && (
        <button type="button" onClick={onDone} className="px-1 text-faint hover:text-ink">
          Skip
        </button>
      )}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
