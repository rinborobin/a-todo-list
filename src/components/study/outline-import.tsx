"use client";

import { useState, useTransition } from "react";
import { readOutlineAction, saveOutlineAction } from "@/actions/outline";
import type { OutlineTopic } from "@/lib/ai/outline-schemas";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { ChevronRightIcon, CloseIcon, DocumentTextIcon } from "@/components/ui/icons";

const MAX_SIDE = 1600;

/**
 * Phone photos are often several MB. Shrinks an image to at most 1600 px on
 * its long side as JPEG, which is plenty to read text and fits the upload
 * limit. PDFs and small images are sent as they are.
 */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

const iconButton =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-line/60 hover:text-ink disabled:opacity-30";

/**
 * Import a course outline: a photo, a PDF or pasted text is read by AI into a
 * draft list that the student checks and edits before anything is saved.
 */
export function OutlineImport({
  subjectId,
  subjectName,
  open,
  onClose,
  onSaved,
}: {
  subjectId: string;
  subjectName: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<OutlineTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, startReading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const read = () => {
    setError(null);
    startReading(async () => {
      const form = new FormData();
      form.set("subjectId", subjectId);
      if (file) {
        const blob = await shrinkImage(file);
        form.set("file", blob, file.name);
      } else {
        form.set("text", text);
      }
      const result = await readOutlineAction(form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDraft(result.data.topics);
    });
  };

  const save = () => {
    if (!draft) return;
    const topics = draft.map((t) => ({ ...t, name: t.name.trim() })).filter((t) => t.name);
    setError(null);
    startSaving(async () => {
      const result = await saveOutlineAction({ subjectId, topics });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved?.(result.data.saved);
      onClose();
    });
  };

  const move = (index: number, by: -1 | 1) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const to = index + by;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  return (
    <Dialog open={open} onClose={onClose} title={`Course outline for ${subjectName}`}>
      {draft === null ? (
        <div className="space-y-4">
          <p className="text-[15px] text-ink-soft">
            Add a photo or PDF of the syllabus, or paste its text. The app lists the topics in order and you check them
            before saving.
          </p>

          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-[15px] hover:border-ink">
            <DocumentTextIcon className="h-4 w-4" />
            {file ? <span className="max-w-[14rem] truncate">{file.name}</span> : "Photo or PDF"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>
          {file && (
            <button type="button" onClick={() => setFile(null)} className="text-sm text-muted hover:text-ink">
              Use pasted text instead
            </button>
          )}

          {!file && (
            <div>
              <label htmlFor={`outline-text-${subjectId}`} className="mb-1.5 block text-[13px] text-ink-soft">
                Or paste the outline
              </label>
              <Textarea
                id={`outline-text-${subjectId}`}
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Week 1  Selectors\nWeek 2  Box model\nWeek 3  Flexbox"}
              />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" disabled={isReading || (!file && !text.trim())} onClick={read}>
              {isReading ? "Reading the outline…" : "Read outline"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[15px] text-ink-soft">
            {draft.length} topics found. Fix names, remove what is not a topic, then save.
          </p>
          <ol className="max-h-[50vh] divide-y divide-line overflow-y-auto border-y border-line">
            {draft.map((t, index) => (
              <li key={index} className="flex items-center gap-1 py-1.5">
                <span className="tabular w-6 shrink-0 text-right text-[13px] text-faint">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`draft-${subjectId}-${index}`} className="sr-only">
                    Topic {index + 1}
                  </label>
                  <Input
                    id={`draft-${subjectId}-${index}`}
                    value={t.name}
                    maxLength={80}
                    className="h-9"
                    onChange={(e) =>
                      setDraft((prev) => prev!.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  {(t.date || t.week) && (
                    <p className="mt-0.5 pl-1 text-[12px] text-muted">
                      {t.date ? `In class ${formatDay(t.date)}` : `Week ${t.week}`}
                    </p>
                  )}
                </div>
                <button type="button" className={iconButton} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${t.name} up`}>
                  <ChevronRightIcon className="h-4 w-4 -rotate-90" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === draft.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${t.name} down`}
                >
                  <ChevronRightIcon className="h-4 w-4 rotate-90" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => setDraft((prev) => prev!.filter((_, i) => i !== index))}
                  aria-label={`Remove ${t.name}`}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" disabled={isSaving || draft.length === 0} onClick={save}>
              {isSaving ? "Saving…" : `Save ${draft.length} topics`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
