"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logStudySessionAction } from "@/actions/study";
import type { StudyRating } from "@/db/schema";
import { RATING_LABEL } from "@/lib/study/labels";
import { addDaysToDateKey } from "@/lib/scheduling/timezone";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNote, Field, Input, Select, Textarea } from "@/components/ui/field";

interface LogStudyDialogProps {
  open: boolean;
  onClose: () => void;
  subjects: { id: string; name: string }[];
  today: string;
}

const DURATIONS = [30, 60, 90, 120];
const RATINGS: StudyRating[] = ["STRUGGLED", "OK", "GOT_IT"];

const chip = (active: boolean) =>
  `h-9 flex-1 rounded-lg text-[13px] transition-colors ${active ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-line"}`;

export function LogStudyDialog({ open, onClose, subjects, today }: LogStudyDialogProps) {
  const router = useRouter();
  const yesterday = addDaysToDateKey(today, -1);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [minutes, setMinutes] = useState("60");
  const [date, setDate] = useState(today);
  const [rating, setRating] = useState<StudyRating | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const result = await logStudySessionAction({
      subjectId: subjectId || null,
      minutes: Number(minutes),
      date,
      rating,
      note: note.trim() || null,
    });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Log study">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="Subject" htmlFor="log-subject">
          <Select id="log-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="">No subject</option>
          </Select>
        </Field>

        <Field label="How long (minutes)" htmlFor="log-minutes">
          <div className="mb-2 flex gap-1.5">
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setMinutes(String(d))} className={chip(minutes === String(d))}>
                {d < 60 ? `${d}m` : d % 60 ? `${Math.floor(d / 60)}h ${d % 60}m` : `${d / 60}h`}
              </button>
            ))}
          </div>
          <Input
            id="log-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>

        <Field label="When" htmlFor="log-date">
          <div className="mb-2 flex gap-1.5">
            <button type="button" onClick={() => setDate(today)} className={chip(date === today)}>
              Today
            </button>
            <button type="button" onClick={() => setDate(yesterday)} className={chip(date === yesterday)}>
              Yesterday
            </button>
          </div>
          <Input id="log-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">How did it go? (optional)</legend>
          <div className="flex gap-1.5">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rating === r}
                onClick={() => setRating(rating === r ? null : r)}
                className={chip(rating === r)}
              >
                {RATING_LABEL[r]}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Note (optional)" htmlFor="log-note">
          <Textarea id="log-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
