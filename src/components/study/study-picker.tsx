"use client";

import { useState, useTransition } from "react";
import { createTopicAction } from "@/actions/outline";
import type { PickerSubject } from "@/lib/study/picker";
import { GOAL_CHOICES } from "@/lib/study/focus-time";
import { KIND_LABEL } from "@/lib/study/labels";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { ArrowLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/icons";

export interface PickedStudy {
  subjectId: string;
  topicId: string | null;
  taskId: string | null;
  minutes: number;
}

const chip = (active: boolean) =>
  `press max-w-full truncate rounded-lg px-3 py-2 text-[14px] transition-colors ${
    active ? "bg-ink text-paper" : "bg-line/60 text-ink-soft hover:bg-line hover:text-ink"
  }`;

/**
 * "Choose what to study": for when the mood decides. Pick one of your own
 * subjects, then a topic in it (or a new one) or, for a side project, one of
 * its tasks, and how long. Only listed subjects can be chosen.
 */
export function StudyPicker({
  subjects,
  open,
  onClose,
  onStart,
  starting,
}: {
  subjects: PickerSubject[];
  open: boolean;
  onClose: () => void;
  onStart: (choice: PickedStudy, origin: HTMLElement) => void;
  starting: boolean;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number>(45);
  const [extraTopics, setExtraTopics] = useState<PickerSubject["topics"]>([]);
  const [newTopic, setNewTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, startAdding] = useTransition();

  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const isProject = subject?.kind === "PROJECT";
  const topics = subject ? [...subject.topics, ...extraTopics.filter((t) => !subject.topics.some((x) => x.id === t.id))] : [];

  const choose = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    setSubjectId(id);
    // Preselect the likely choice: the next topic, or the project's next task.
    setTopicId(s?.topics.find((t) => t.next)?.id ?? null);
    setTaskId(s?.tasks.find((t) => t.next)?.id ?? null);
    setExtraTopics([]);
    setNewTopic(null);
    setError(null);
  };

  const addTopic = () => {
    if (!subject || !newTopic?.trim()) return;
    setError(null);
    startAdding(async () => {
      const result = await createTopicAction({ subjectId: subject.id, name: newTopic });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setExtraTopics((prev) => [...prev, { id: result.data.id, name: result.data.name, next: false, studied: false }]);
      setTopicId(result.data.id);
      setNewTopic(null);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={subject ? subject.name : "What are you studying?"}>
      {!subject ? (
        subjects.length === 0 ? (
          <p className="text-[15px] text-muted">Add a class, side project or something you learn on your own in Me first.</p>
        ) : (
          <ul className="-mx-1 divide-y divide-line">
            {subjects.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => choose(s.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left hover:bg-line/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{s.name}</span>
                    <span className="block text-[13px] text-muted">
                      {KIND_LABEL[s.kind]}
                      {s.kind === "PROJECT"
                        ? s.tasks[0]
                          ? ` · next: ${s.tasks[0].title}`
                          : ""
                        : s.topics.find((t) => t.next)
                          ? ` · next: ${s.topics.find((t) => t.next)!.name}`
                          : ""}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setSubjectId(null)}
            className="-mt-2 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Something else
          </button>

          <div>
            <p className="mb-2 text-[13px] text-ink-soft">{isProject ? "Working on" : "Topic"}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={isProject ? "Task" : "Topic"}>
              <button
                type="button"
                aria-pressed={isProject ? taskId === null : topicId === null}
                onClick={() => (isProject ? setTaskId(null) : setTopicId(null))}
                className={chip(isProject ? taskId === null : topicId === null)}
              >
                Just {subject.name}
              </button>
              {isProject
                ? subject.tasks.map((t) => (
                    <button key={t.id} type="button" aria-pressed={taskId === t.id} onClick={() => setTaskId(t.id)} className={chip(taskId === t.id)}>
                      {t.title}
                      {t.next && <span className={taskId === t.id ? "opacity-70" : "text-accent"}> · next</span>}
                    </button>
                  ))
                : topics.map((t) => (
                    <button key={t.id} type="button" aria-pressed={topicId === t.id} onClick={() => setTopicId(t.id)} className={chip(topicId === t.id)}>
                      {t.name}
                      {t.next && <span className={topicId === t.id ? "opacity-70" : "text-accent"}> · next</span>}
                    </button>
                  ))}
              {!isProject && newTopic === null && (
                <button
                  type="button"
                  onClick={() => setNewTopic("")}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] text-muted hover:text-ink"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  New topic
                </button>
              )}
            </div>
            {!isProject && newTopic !== null && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addTopic();
                }}
              >
                <label htmlFor="picker-new-topic" className="sr-only">
                  New topic in {subject.name}
                </label>
                <Input
                  id="picker-new-topic"
                  autoFocus
                  value={newTopic}
                  maxLength={80}
                  placeholder={`A topic in ${subject.name}`}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
                <Button type="submit" disabled={isAdding || !newTopic.trim()}>
                  Add
                </Button>
              </form>
            )}
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>

          <div>
            <p className="mb-2 text-[13px] text-ink-soft">For about</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Length">
              {GOAL_CHOICES.map((m) => (
                <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>
                  {formatDuration(m)}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            className="h-12 w-full"
            disabled={starting}
            onClick={(e) =>
              onStart(
                { subjectId: subject.id, topicId: isProject ? null : topicId, taskId: isProject ? taskId : null, minutes },
                e.currentTarget
              )
            }
          >
            {starting ? "Starting…" : "Start"}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
