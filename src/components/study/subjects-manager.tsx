"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Subject } from "@/db/schema";
import { archiveSubjectAction, createSubjectAction, renameSubjectAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export function SubjectsManager({ initialSubjects }: { initialSubjects: Subject[] }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState(initialSubjects);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = subjects.filter((s) => !s.archivedAt);
  const archived = subjects.filter((s) => s.archivedAt);

  const replace = (updated: Subject) =>
    setSubjects((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name))
    );

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createSubjectAction({ name: newName });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSubjects((prev) => [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      router.refresh();
    });
  };

  const saveRename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const result = await renameSubjectAction(editing);
      if (!result.success) {
        setError(result.error);
        return;
      }
      replace(result.data);
      setEditing(null);
      router.refresh();
    });
  };

  const setArchived = (id: string, value: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await archiveSubjectAction(id, value);
      if (!result.success) {
        setError(result.error);
        return;
      }
      replace(result.data);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="subjects-heading">
      <h2 id="subjects-heading" className={sectionTitle}>
        Subjects
      </h2>
      <p className="mt-1 text-sm text-muted">
        Study time is grouped by subject. In quick-add, type <span className="font-medium text-ink">#</span> and the
        start of a name, like <span className="font-medium text-ink">#calc</span>.
      </p>

      {active.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {active.map((s) =>
            editing?.id === s.id ? (
              <li key={s.id} className="py-2">
                <form onSubmit={saveRename} className="flex gap-2">
                  <label htmlFor={`rename-${s.id}`} className="sr-only">
                    New name for {s.name}
                  </label>
                  <Input
                    id={`rename-${s.id}`}
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                    maxLength={60}
                  />
                  <Button type="submit" variant="primary" disabled={isPending}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              </li>
            ) : (
              <li key={s.id} className="flex items-center gap-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setEditing({ id: s.id, name: s.name })}
                  aria-label={`Rename ${s.name}`}
                  className="min-w-0 flex-1 truncate py-1.5 text-left text-[15px] font-medium hover:underline"
                >
                  {s.name}
                </button>
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setArchived(s.id, true)}>
                  Archive
                </Button>
              </li>
            )
          )}
        </ul>
      )}

      <form onSubmit={add} className="mt-3 flex gap-2">
        <label htmlFor="new-subject" className="sr-only">
          New subject
        </label>
        <Input
          id="new-subject"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={active.length === 0 ? "Calculus" : "Add a subject"}
          maxLength={60}
        />
        <Button type="submit" disabled={isPending || !newName.trim()}>
          <PlusIcon className="h-4 w-4" />
          Add
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {archived.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="text-sm text-muted hover:text-ink"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm text-muted">
                  {s.name}
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setArchived(s.id, false)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
