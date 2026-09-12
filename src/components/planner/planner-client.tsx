"use client";

import { useState } from "react";
import { PlannerControls } from "./planner-controls";
import { ProposalForm } from "./proposal-form";
import { ProposalView } from "./proposal-view";
import { PlanView } from "./plan-view";
import type { PlanWithItems, TaskProposalResult } from "@/actions/planner";

interface PlannerClientProps {
  plans: PlanWithItems[];
  timezone: string;
}

export function PlannerClient({ plans, timezone }: PlannerClientProps) {
  const [activeProposal, setActiveProposal] = useState<{
    proposal: TaskProposalResult;
    startDate: string;
    endDate: string;
  } | null>(null);

  const handleProposal = (proposal: TaskProposalResult, startDate: string, endDate: string) => {
    setActiveProposal({ proposal, startDate, endDate });
  };

  const handleCancelProposal = () => {
    setActiveProposal(null);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            Plan with AI
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Describe your goals and review a proposed set of tasks before they are created.
          </p>
        </div>

        {activeProposal ? (
          <ProposalView
            proposal={activeProposal.proposal}
            startDate={activeProposal.startDate}
            endDate={activeProposal.endDate}
            onCancel={handleCancelProposal}
          />
        ) : (
          <ProposalForm onProposal={handleProposal} />
        )}
      </div>

      <PlannerControls />

      <PlanView plans={plans} timezone={timezone} />
    </div>
  );
}
