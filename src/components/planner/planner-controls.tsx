"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatePlanAction, generatePlanWithAIAction } from "@/actions/planner";
import { CalendarIcon, PlusIcon, PlayIcon } from "@/components/ui/icons";

export function PlannerControls() {
  const router = useRouter();
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiFallbackNotice, setAiFallbackNotice] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setAiFallbackNotice(null);

    const result = await generatePlanAction({ startDate, endDate });

    setIsGenerating(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleGenerateWithAI = async () => {
    setIsGeneratingAI(true);
    setError(null);
    setAiFallbackNotice(null);

    const result = await generatePlanWithAIAction({ startDate, endDate });

    setIsGeneratingAI(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (!result.data.aiGenerated) {
      setAiFallbackNotice("AI suggestions were unavailable. Your standard schedule was generated instead.");
    }

    router.refresh();
  };

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="start-date" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Start date
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          <label htmlFor="end-date" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            End date
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isGeneratingAI}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate plan"}
          </button>

          <button
            type="button"
            onClick={handleGenerateWithAI}
            disabled={isGenerating || isGeneratingAI}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <PlayIcon className="h-4 w-4" />
            {isGeneratingAI ? "Generating AI plan..." : "Generate with AI"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {aiFallbackNotice && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{aiFallbackNotice}</p>
      )}
    </div>
  );
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
