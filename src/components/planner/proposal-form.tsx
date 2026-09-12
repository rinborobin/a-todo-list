"use client";

import { useState } from "react";
import { generateTaskProposalAction, type TaskProposalResult } from "@/actions/planner";
import { CalendarIcon, PlayIcon } from "@/components/ui/icons";

interface ProposalFormProps {
  onProposal: (proposal: TaskProposalResult, startDate: string, endDate: string) => void;
}

export function ProposalForm({ onProposal }: ProposalFormProps) {
  const [request, setRequest] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(addDays(new Date(), 6)));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await generateTaskProposalAction({ request, startDate, endDate });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onProposal(result.data, startDate, endDate);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="proposal-request" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Describe what you want to plan
        </label>
        <textarea
          id="proposal-request"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Example: I need to prepare a presentation, review two documents, and book a dentist appointment by Friday."
          rows={3}
          maxLength={2000}
          required
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-y"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {request.length}/2000
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="proposal-start" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Start date
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="proposal-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          <label htmlFor="proposal-end" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            End date
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="proposal-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || request.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <PlayIcon className="h-4 w-4" />
          {isLoading ? "Planning..." : "Plan with AI"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
