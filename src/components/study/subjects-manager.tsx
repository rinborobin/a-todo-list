"use client";

import { useState, useTransition } from "react";
import type { Subject } from "@/db/schema";
import { archiveSubjectAction, createSubjectAction, renameSubjectAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { SubjectSetupFields, describeSetup } from "./subject-setup-fields";
import { TopicList } from "./topic-list";

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export function SubjectsManager({
  initialSubjects,
  topics,
  today,
}: {
  initialSubjects: Subject[];
  topics: { id: string; name: string; subjectId: string }[];
  today: string;
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
              <li key={s.id} className="py-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    aria-expanded={openId === s.id}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                  >
                    <ChevronRightIcon
                      className={`h-4 w-4 shrink-0 text-faint transition-transform ${openId === s.id ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      {describeSetup(s) && <span className="block text-[13px] text-muted">{describeSetup(s)}</span>}
                    </span>
                  </button>
                </div>
                {openId === s.id && (
                  <div className="rise pb-3 pl-6 pt-2">
                    <SubjectSetupFields
                      subject={{
                        id: s.id,
                        name: s.name,
                        confidence: s.confidence,
                        examDate: s.examDate,
                        weeklyGoalMinutes: s.weeklyGoalMinutes,
                      }}
                      today={today}
                    />
                    <div className="mt-5">
                      <TopicList topics={topics.filter((t) => t.subjectId === s.id)} />
                    </div>
                    <div className="mt-4 flex gap-1 border-t border-line pt-3">
                      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setEditing({ id: s.id, name: s.name })}>
                        Rename subject
                      </Button>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setArchived(s.id, true)}>
                        Archive subject
                      </Button>
                    </div>
                  </div>
                )}
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
