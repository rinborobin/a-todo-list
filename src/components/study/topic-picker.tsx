"use client";

import { useState, useTransition } from "react";
import { setSessionTopicAction } from "@/actions/study";
import { PlusIcon } from "@/components/ui/icons";

export interface TopicOption {
  id: string;
  name: string;
}

const MAX_CHIPS = 6;

const chip = (active: boolean) =>
  `h-9 rounded-lg px-3 text-[13px] transition-colors ${active ? "bg-ink text-paper" : "bg-line/60 text-ink-soft hover:bg-line"}`;

interface TopicChipsProps {
  topics: TopicOption[];
  selectedId: string | null;
  /** A new name chosen but not saved yet (log dialog). */
  pendingName?: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}

/** Recent topics as one-tap chips, plus "+ New topic". Presentational. */
export function TopicChips({
  topics,
  selectedId,
  pendingName = null,
  onSelect,
  onCreate,
  disabled,
  label = "What did you cover?",
}: TopicChipsProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    setName("");
    setAdding(false);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {topics.slice(0, MAX_CHIPS).map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            aria-pressed={selectedId === t.id}
            onClick={() => onSelect(selectedId === t.id ? null : t.id)}
            className={chip(selectedId === t.id)}
          >
            {t.name}
          </button>
        ))}
        {pendingName && (
          <span className={chip(true)} style={{ display: "inline-flex", alignItems: "center" }}>
            {pendingName}
          </span>
        )}
        {adding ? (
          <span className="flex items-center gap-1">
            <label htmlFor="new-topic" className="sr-only">
              New topic
            </label>
            <input
              id="new-topic"
              autoFocus
              value={name}
              maxLength={80}
              placeholder="e.g. Limits"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              className="h-9 w-36 rounded-lg border border-line-strong bg-sheet px-2.5 text-base text-ink focus:border-ink focus:outline-none sm:text-[13px]"
            />
            <button
              type="button"
              disabled={disabled || !name.trim()}
              onClick={() => void submit()}
              className="h-9 rounded-lg bg-ink px-3 text-[13px] text-paper disabled:opacity-40"
            >
              Add
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAdding(true)}
            className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] text-muted hover:bg-line/60 hover:text-ink"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New topic
          </button>
        )}
      </div>
    </div>
  );
}

/** Topic chips for a finished session: every tap saves straight away. */
export function SessionTopicPicker({
  sessionId,
  topics: initialTopics,
  initialTopicId = null,
  label,
}: {
  sessionId: string;
  topics: TopicOption[];
  initialTopicId?: string | null;
  label?: string;
}) {
  const [topics, setTopics] = useState(initialTopics);
  const [selectedId, setSelectedId] = useState<string | null>(initialTopicId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (choice: { topicId: string | null } | { newName: string }, optimistic: string | null) => {
    const previous = selectedId;
    setSelectedId(optimistic);
    setError(null);
    startTransition(async () => {
      const result = await setSessionTopicAction({ sessionId, choice });
      if (!result.success) {
        setSelectedId(previous);
        setError(result.error);
        return;
      }
      const { topicId, topicName } = result.data;
      if (topicId && topicName && !topics.some((t) => t.id === topicId)) {
        setTopics((prev) => [{ id: topicId, name: topicName }, ...prev]);
      }
      setSelectedId(topicId);
    });
  };

  return (
    <div>
      <TopicChips
        topics={topics}
        selectedId={selectedId}
        disabled={isPending}
        label={label}
        onSelect={(id) => save({ topicId: id }, id)}
        onCreate={(name) => save({ newName: name }, null)}
      />
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
