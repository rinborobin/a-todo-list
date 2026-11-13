"use client";

import { useState } from "react";
import { confirmTaskProposalAction, type TaskProposalResult } from "@/actions/planner";
import { CheckIcon, CloseIcon, TrashIcon, AlertTriangleIcon } from "@/components/ui/icons";
import type { ProposalItem, ExistingProposalItem, NewProposalItem } from "@/lib/ai/proposal-schemas";

interface ProposalViewProps {
  proposal: TaskProposalResult;
  startDate: string;
  endDate: string;
  onCancel: () => void;
}

export function ProposalView({ proposal, startDate, endDate, onCancel }: ProposalViewProps) {
  const [items, setItems] = useState<ProposalItem[]>(proposal.items);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateNew = (index: number, updates: Partial<NewProposalItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.type !== "new") return item;
        return { ...item, ...updates };
      })
    );
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      setError("Add at least one item before confirming.");
      return;
    }

    setIsConfirming(true);
    setError(null);

    const result = await confirmTaskProposalAction({
      startDate,
      endDate,
      items,
    });

    setIsConfirming(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onCancel();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-ink">
          Proposed tasks
        </h2>
        <p className="text-xs text-muted">
          {startDate} to {endDate}
        </p>
      </div>

      {proposal.notes.length > 0 && (
        <div className="space-y-1">
          {proposal.notes.map((note, i) => (
            <p key={i} className="text-sm text-ink-soft">
              {note}
            </p>
          ))}
        </div>
      )}

      {proposal.warnings.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-transparent bg-accent-soft p-3">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <ul className="list-disc space-y-1 pl-4 text-sm text-accent">
            {proposal.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, index) =>
          item.type === "existing" ? (
            <ExistingItemRow
              key={`${item.taskId}-${index}`}
              item={item}
              index={index}
              onRemove={handleRemove}
            />
          ) : (
            <NewItemRow
              key={index}
              item={item}
              index={index}
              onUpdate={handleUpdateNew}
              onRemove={handleRemove}
            />
          )
        )}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted">
          All proposed items were removed. Cancel to start over.
        </p>
      )}

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming || items.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 h-11 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-50 transition-colors cursor-pointer"
        >
          <CheckIcon className="h-4 w-4" />
          {isConfirming ? "Confirming..." : "Confirm and schedule"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-transparent px-4 h-11 text-sm font-medium text-ink-soft hover:bg-line/60 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <CloseIcon className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ExistingItemRowProps {
  item: ExistingProposalItem;
  index: number;
  onRemove: (index: number) => void;
}

function ExistingItemRow({ item, index, onRemove }: ExistingItemRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
      <div className="mt-0.5">
        <CheckIcon className="h-4 w-4 text-ink" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">
          {item.title ?? item.taskId}
        </p>
        <p className="text-xs text-muted">
          Existing task
        </p>
        {item.reason && (
          <p className="mt-1 text-xs text-muted">
            {item.reason}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Remove proposed task"
        className="rounded-lg p-1.5 text-faint hover:bg-line/60 hover:text-ink-soft transition-colors cursor-pointer"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

interface NewItemRowProps {
  item: NewProposalItem;
  index: number;
  onUpdate: (index: number, updates: Partial<NewProposalItem>) => void;
  onRemove: (index: number) => void;
}

function NewItemRow({ item, index, onUpdate, onRemove }: NewItemRowProps) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <CheckIcon className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            New task
          </p>
          {item.reason && (
            <p className="text-xs text-muted">
              {item.reason}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Remove proposed task"
          className="rounded-lg p-1.5 text-faint hover:bg-line/60 hover:text-ink-soft transition-colors cursor-pointer"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-soft">
            Title
          </label>
          <input
            type="text"
            value={item.title}
            onChange={(e) => onUpdate(index, { title: e.target.value })}
            maxLength={200}
            className="w-full rounded-lg border border-line-strong bg-sheet px-2.5 py-1.5 text-base sm:text-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-soft">
            Priority
          </label>
          <select
            value={item.priority}
            onChange={(e) =>
              onUpdate(index, { priority: e.target.value as NewProposalItem["priority"] })
            }
            className="w-full rounded-lg border border-line-strong bg-sheet px-2.5 py-1.5 text-base sm:text-sm text-ink focus:border-ink focus:outline-none cursor-pointer"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-soft">
            Estimated minutes
          </label>
          <input
            type="number"
            value={item.estimatedMinutes}
            onChange={(e) => onUpdate(index, { estimatedMinutes: Number(e.target.value) })}
            min={1}
            max={1440}
            className="w-full rounded-lg border border-line-strong bg-sheet px-2.5 py-1.5 text-base sm:text-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-soft">
            Deadline
          </label>
          <input
            type="datetime-local"
            value={item.deadline ? toDatetimeLocal(new Date(item.deadline)) : ""}
            onChange={(e) =>
              onUpdate(index, { deadline: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            className="w-full rounded-lg border border-line-strong bg-sheet px-2.5 py-1.5 text-base sm:text-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-soft">
          Description
        </label>
        <textarea
          value={item.description ?? ""}
          onChange={(e) => onUpdate(index, { description: e.target.value || null })}
          rows={2}
          maxLength={2000}
          className="w-full rounded-lg border border-line-strong bg-sheet px-2.5 py-1.5 text-base sm:text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none resize-y"
        />
      </div>
    </div>
  );
}

function toDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
