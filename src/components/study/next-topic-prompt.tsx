"use client";

import { useEffect, useState, useTransition } from "react";
import { suggestNextTopicAction, type NextTopicSuggestion } from "@/actions/outline";
import { archiveTopicAction } from "@/actions/study";

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

/**
 * After a session that went well: what to learn next in the subject. It comes
 * from the topic list (course outline) when there is one, otherwise the AI
 * suggests one, which is kept on the list. "Not this" drops it and asks again.
 */
export function NextTopicPrompt({
  subjectId,
  subjectName,
  afterTopicId,
  align = "center",
}: {
  subjectId: string;
  subjectName: string;
  afterTopicId: string | null;
  align?: "center" | "start";
}) {
  const [state, setState] = useState<{ status: "loading" } | { status: "done"; next: NextTopicSuggestion | null }>({
    status: "loading",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    suggestNextTopicAction({ subjectId, afterTopicId }).then((result) => {
      if (!cancelled) setState({ status: "done", next: result.success ? result.data : null });
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, afterTopicId]);

  const dismiss = (topicId: string) =>
    startTransition(async () => {
      setState({ status: "loading" });
      await archiveTopicAction(topicId, true);
      const result = await suggestNextTopicAction({ subjectId, afterTopicId });
      setState({ status: "done", next: result.success ? result.data : null });
    });

  const box = `w-full max-w-sm border-l-2 border-accent pl-3 text-left ${align === "center" ? "mx-auto" : ""}`;

  if (state.status === "loading") {
    return (
      <p className={`${box} text-[13px] text-muted`} role="status">
        Finding what comes next in {subjectName}…
      </p>
    );
  }
  if (!state.next) return null;

  const { topic } = state.next;
  const why =
    topic.origin === "AI" && topic.reason
      ? topic.reason
      : topic.plannedOn
        ? `Next in your outline, in class ${formatDay(topic.plannedOn)}.`
        : "Next on your topic list.";

  return (
    <div className={`${box} rise`} role="status">
      <p className="text-xs text-muted">Next in {subjectName}</p>
      <p className="mt-0.5 text-[17px] font-medium leading-snug">{topic.name}</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">{why}</p>
      <p className="mt-1 text-[13px] text-muted">
        It shows up in Next up.{" "}
        <button
          type="button"
          disabled={isPending}
          onClick={() => dismiss(topic.id)}
          className="underline-offset-4 hover:text-ink hover:underline"
        >
          Not this
        </button>
      </p>
    </div>
  );
}
