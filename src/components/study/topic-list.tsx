"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveTopicAction, renameTopicAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** Topics of one subject on Me: rename a typo, archive what is done. */
export function TopicList({ topics: initial }: { topics: { id: string; name: string }[] }) {
  const router = useRouter();
  const [topics, setTopics] = useState(initial);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (topics.length === 0) {
    return <p className="text-[13px] text-muted">No topics yet. They appear when you note what a session covered.</p>;
  }

  const rename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    startTransition(async () => {
      const result = await renameTopicAction(editing);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTopics((prev) => prev.map((t) => (t.id === editing.id ? { ...t, name: result.data.name } : t)));
      setEditing(null);
      setError(null);
      router.refresh();
    });
  };

  const archive = (id: string) => {
    startTransition(async () => {
      const result = await archiveTopicAction(id, true);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTopics((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    });
  };

  return (
    <div>
      <p className="mb-1 text-[13px] text-ink-soft">Topics</p>
      <ul className="divide-y divide-line">
        {topics.map((t) =>
          editing?.id === t.id ? (
            <li key={t.id} className="py-1.5">
              <form onSubmit={rename} className="flex gap-2">
                <label htmlFor={`topic-${t.id}`} className="sr-only">
                  New name for {t.name}
                </label>
                <Input
                  id={`topic-${t.id}`}
                  autoFocus
                  value={editing.name}
                  maxLength={80}
                  onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
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
            <li key={t.id} className="flex items-center gap-1 py-1">
              <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditing({ id: t.id, name: t.name })}>
                Rename
              </Button>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => archive(t.id)}>
                Archive
              </Button>
            </li>
          )
        )}
      </ul>
      {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
