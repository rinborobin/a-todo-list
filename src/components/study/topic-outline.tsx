"use client";

import { useState, useTransition } from "react";
import { archiveTopicAction, renameTopicAction } from "@/actions/study";
import { createTopicAction } from "@/actions/outline";
import type { StudyRating, TopicOrigin } from "@/db/schema";
import { RATING_LABEL } from "@/lib/study/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { OutlineImport } from "./outline-import";
import { useAddedSince } from "@/components/ui/motion";

export interface OutlineTopicRow {
  id: string;
  name: string;
  position: number | null;
  origin: TopicOrigin;
  plannedOn: string | null;
  reason: string | null;
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

function order(a: OutlineTopicRow, b: OutlineTopicRow) {
  return (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name);
}

/**
 * The topics of a class or self-learning subject, in the order to learn them:
 * what was studied (and how it felt), what is next, and when class covers it.
 * Topics come from an imported outline, are added by hand, or are named after
 * a session.
 */
export function TopicOutline({
  subjectId,
  subjectName,
  topics: initial,
  progress,
}: {
  subjectId: string;
  subjectName: string;
  topics: OutlineTopicRow[];
  /** Latest rating per studied topic id; topics missing here are not studied yet. */
  progress: Record<string, { rating: StudyRating | null }>;
}) {
  const [topics, setTopics] = useState(() => [...initial].sort(order));
  // Take the server list when it changes (import, add, rename revalidate the page).
  const signature = initial.map((t) => `${t.id}:${t.name}:${t.position}:${t.plannedOn}`).join("|");
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setTopics([...initial].sort(order));
  }
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextId = topics.find((t) => !progress[t.id])?.id ?? null;
  const isAdded = useAddedSince(topics);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    startTransition(fn);
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    run(async () => {
      const result = await createTopicAction({ subjectId, name: newName });
      if (!result.success) return setError(result.error);
      setTopics((prev) => [...prev.filter((t) => t.id !== result.data.id), result.data].sort(order));
      setNewName("");
    });
  };

  const rename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    run(async () => {
      const result = await renameTopicAction(editing);
      if (!result.success) return setError(result.error);
      setTopics((prev) => prev.map((t) => (t.id === editing.id ? { ...t, name: result.data.name } : t)));
      setEditing(null);
    });
  };

  const archive = (id: string) =>
    run(async () => {
      const result = await archiveTopicAction(id, true);
      if (!result.success) return setError(result.error);
      setTopics((prev) => prev.filter((t) => t.id !== id));
      setEditing(null);
    });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[13px] text-ink-soft">Topics</p>
        <Button variant="ghost" size="sm" className="-mr-3" onClick={() => setImporting(true)}>
          Import course outline
        </Button>
      </div>

      {topics.length === 0 ? (
        <p className="text-[13px] text-muted">
          No topics yet. Import the course outline, add them here, or note what a session covered.
        </p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {topics.map((t) => {
            const studied = progress[t.id];
            if (editing?.id === t.id) {
              return (
                <li key={t.id} className="py-2">
                  <form onSubmit={rename} className="flex flex-wrap gap-2">
                    <label htmlFor={`topic-${t.id}`} className="sr-only">
                      New name for {t.name}
                    </label>
                    <Input
                      id={`topic-${t.id}`}
                      autoFocus
                      value={editing.name}
                      maxLength={80}
                      className="min-w-0 flex-1 basis-40"
                      onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => archive(t.id)}>
                      Remove
                    </Button>
                  </form>
                </li>
              );
            }
            const meta = [
              studied ? (studied.rating ? RATING_LABEL[studied.rating] : "Studied") : t.id === nextId ? "Next" : null,
              t.plannedOn ? `in class ${formatDay(t.plannedOn)}` : null,
              !studied && t.origin === "AI" ? "suggested" : null,
            ].filter(Boolean);
            return (
              <li key={t.id} className={isAdded(t.id) ? "enter" : ""}>
                <button
                  type="button"
                  onClick={() => setEditing({ id: t.id, name: t.name })}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      studied ? "border-ink bg-ink text-paper" : t.id === nextId ? "border-[5px] border-ink" : "border-line-strong"
                    }`}
                    aria-hidden="true"
                  >
                    {studied && <CheckIcon className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${t.id === nextId ? "font-medium" : ""}`}>{t.name}</span>
                    {meta.length > 0 && (
                      <span
                        className={`block text-[13px] ${studied?.rating === "STRUGGLED" ? "text-accent" : "text-muted"}`}
                      >
                        {meta.join(" · ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={add} className="mt-2 flex gap-2">
        <label htmlFor={`new-topic-${subjectId}`} className="sr-only">
          Add a topic
        </label>
        <Input
          id={`new-topic-${subjectId}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a topic"
          maxLength={80}
        />
        <Button type="submit" disabled={isPending || !newName.trim()}>
          <PlusIcon className="h-4 w-4" />
          Add
        </Button>
      </form>
      {notice && (
        <p className="mt-2 text-[13px] text-ink-soft" role="status">
          {notice}
        </p>
      )}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

      {importing && (
        <OutlineImport
          subjectId={subjectId}
          subjectName={subjectName}
          open={importing}
          onClose={() => setImporting(false)}
          // Saving revalidates the page; the new order arrives through the props.
          onSaved={(count) => setNotice(`Saved ${count} topics.`)}
        />
      )}
    </div>
  );
}
