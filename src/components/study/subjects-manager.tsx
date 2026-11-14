"use client";

import { useState, useTransition } from "react";
import type { Milestone, StudyRating, Subject, SubjectKind } from "@/db/schema";
import { archiveSubjectAction, createSubjectAction, renameSubjectAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { KindPicker, SubjectSetupFields, describeSetup } from "./subject-setup-fields";
import { toSetupSubject } from "./setup-subject";
import { TopicOutline, type OutlineTopicRow } from "./topic-outline";

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

const PLACEHOLDER: Record<SubjectKind, string> = {
  CLASS: "Add a class",
  PROJECT: "Add a side project",
  SELF_LEARNING: "Add something to learn",
};

export function SubjectsManager({
  initialSubjects,
  topics,
  topicProgress,
  milestones,
  milestoneProgress,
  today,
}: {
  initialSubjects: Subject[];
  topics: (OutlineTopicRow & { subjectId: string })[];
  topicProgress: Record<string, { rating: StudyRating | null }>;
  milestones: Milestone[];
  milestoneProgress: Record<string, { done: number; total: number }>;
  today: string;
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<SubjectKind>("CLASS");
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
      const result = await createSubjectAction({ name: newName, kind: newKind });
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
        What you are working on
      </h2>
      <p className="mt-1 text-sm text-muted">
        Classes, side projects and self-learning. Time is grouped by each one. In quick-add, type{" "}
        <span className="font-medium text-ink">#</span> and the start of a name, like{" "}
        <span className="font-medium text-ink">#calc</span>.
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
                      subject={toSetupSubject(s)}
                      today={today}
                      showKind
                      milestones={milestones.filter((m) => m.subjectId === s.id)}
                      milestoneProgress={milestoneProgress}
                      onSaved={replace}
                    />
                    {s.kind !== "PROJECT" && (
                      <div className="mt-5">
                        {(() => {
                          const own = topics.filter((t) => t.subjectId === s.id);
                          // Remount when the server list changes (import, add, rename).
                          const signature = own.map((t) => `${t.id}:${t.name}:${t.position}:${t.plannedOn}`).join("|");
                          return (
                            <TopicOutline
                              key={signature}
                              subjectId={s.id}
                              subjectName={s.name}
                              topics={own}
                              progress={topicProgress}
                            />
                          );
                        })()}
                      </div>
                    )}
                    <div className="mt-4 flex gap-1 border-t border-line pt-3">
                      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setEditing({ id: s.id, name: s.name })}>
                        Rename
                      </Button>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setArchived(s.id, true)}>
                        Archive
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}

      <div className="mt-4">
        <KindPicker compact value={newKind} onChange={setNewKind} />
      </div>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <label htmlFor="new-subject" className="sr-only">
          {PLACEHOLDER[newKind]}
        </label>
        <Input
          id="new-subject"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={PLACEHOLDER[newKind]}
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
