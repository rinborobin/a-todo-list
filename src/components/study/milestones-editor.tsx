"use client";

import { useState, useTransition } from "react";
import { createMilestoneAction, deleteMilestoneAction, updateMilestoneAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CheckIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useAddedSince } from "@/components/ui/motion";

export interface EditableMilestone {
  id: string;
  name: string;
  targetDate: string | null;
  completedAt: Date | null;
  sortOrder: number;
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

const iconButton =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-line/60 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * The steps of a side project, in order. The first unfinished one is what the
 * app works towards; its tasks come first in "Next up".
 */
export function MilestonesEditor({
  subjectId,
  initialMilestones,
  progress = {},
}: {
  subjectId: string;
  initialMilestones: EditableMilestone[];
  /** Finished and total tasks per milestone id. */
  progress?: Record<string, { done: number; total: number }>;
}) {
  const [milestones, setMilestones] = useState(() =>
    [...initialMilestones].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; targetDate: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentId = milestones.find((m) => !m.completedAt)?.id ?? null;
  const isAdded = useAddedSince(milestones);
  // Milestones ticked in this visit, so only those animate.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(fn);
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      const result = await createMilestoneAction({ subjectId, name, targetDate: date || null });
      if (!result.success) return setError(result.error);
      setMilestones((prev) => [...prev, result.data]);
      setName("");
      setDate("");
    });
  };

  const update = (id: string, changes: { name?: string; targetDate?: string | null; done?: boolean }) =>
    run(async () => {
      const result = await updateMilestoneAction({ id, ...changes });
      if (!result.success) return setError(result.error);
      setMilestones((prev) => prev.map((m) => (m.id === id ? result.data : m)));
      if (changes.done) setTicked((prev) => new Set(prev).add(id));
      setEditing(null);
    });

  const move = (id: string, direction: "up" | "down") => {
    const index = milestones.findIndex((m) => m.id === id);
    const to = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || to < 0 || to >= milestones.length) return;
    const previous = milestones;
    const next = [...milestones];
    [next[index], next[to]] = [next[to], next[index]];
    setMilestones(next);
    run(async () => {
      const result = await updateMilestoneAction({ id, move: direction });
      if (!result.success) {
        setMilestones(previous);
        setError(result.error);
      }
    });
  };

  const remove = (id: string) =>
    run(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.success) return setError(result.error);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    });

  return (
    <div>
      <p className="text-[13px] text-ink-soft">Milestones</p>
      <p className="mt-0.5 text-[13px] text-muted">
        Big steps in order, like MVP then Launch. Tasks you put in the current one are suggested first.
      </p>

      {milestones.length > 0 && (
        <ol className="mt-2 divide-y divide-line border-y border-line">
          {milestones.map((m, index) => {
            const done = m.completedAt !== null;
            const counts = progress[m.id];
            if (editing?.id === m.id) {
              return (
                <li key={m.id} className="py-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!editing.name.trim()) return;
                      update(m.id, { name: editing.name, targetDate: editing.targetDate || null });
                    }}
                    className="space-y-2"
                  >
                    <label htmlFor={`ms-name-${m.id}`} className="sr-only">
                      Milestone name
                    </label>
                    <Input
                      id={`ms-name-${m.id}`}
                      autoFocus
                      value={editing.name}
                      maxLength={60}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                    <label htmlFor={`ms-date-${m.id}`} className="sr-only">
                      Target date
                    </label>
                    <Input
                      id={`ms-date-${m.id}`}
                      type="date"
                      value={editing.targetDate}
                      onChange={(e) => setEditing({ ...editing, targetDate: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="ghost" className="ml-auto" disabled={isPending} onClick={() => remove(m.id)}>
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </form>
                </li>
              );
            }
            return (
              <li key={m.id} className={`flex items-center gap-1 py-1 ${isAdded(m.id) ? "enter" : ""}`}>
                <button
                  type="button"
                  onClick={() => update(m.id, { done: !done })}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${m.name} not done` : `Mark ${m.name} done`}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-line/60`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border ${
                      done ? "border-ink bg-ink text-paper" : "border-line-strong"
                    } ${done && ticked.has(m.id) ? "tick" : ""}`}
                  >
                    {done && <CheckIcon className="h-3 w-3" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ id: m.id, name: m.name, targetDate: m.targetDate ?? "" })}
                  className="min-w-0 flex-1 py-1 text-left"
                >
                  <span className={`block truncate text-[15px] ${done ? "text-muted line-through" : "font-medium"}`}>
                    {m.name}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {[
                      m.id === currentId ? "Now" : null,
                      m.targetDate ? `by ${formatDay(m.targetDate)}` : null,
                      counts && counts.total > 0 ? `${counts.done}/${counts.total} tasks` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Tap to edit"}
                  </span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={isPending || index === 0}
                  onClick={() => move(m.id, "up")}
                  aria-label={`Move ${m.name} up`}
                >
                  <ChevronRightIcon className="h-4 w-4 -rotate-90" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={isPending || index === milestones.length - 1}
                  onClick={() => move(m.id, "down")}
                  aria-label={`Move ${m.name} down`}
                >
                  <ChevronRightIcon className="h-4 w-4 rotate-90" />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={add} className="mt-2 flex flex-wrap gap-2">
        <label htmlFor={`ms-new-${subjectId}`} className="sr-only">
          New milestone
        </label>
        <Input
          id={`ms-new-${subjectId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={milestones.length === 0 ? "MVP" : "Add a milestone"}
          maxLength={60}
          className="min-w-0 flex-1 basis-40"
        />
        <label htmlFor={`ms-new-date-${subjectId}`} className="sr-only">
          Target date (optional)
        </label>
        <Input
          id={`ms-new-date-${subjectId}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto basis-36"
        />
        <Button type="submit" disabled={isPending || !name.trim()}>
          <PlusIcon className="h-4 w-4" />
          Add
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
