import type { AiContextTask, AiTaskProposal, ProposalItem } from "./proposal-schemas";

export interface ProposalValidationResult {
  valid: boolean;
  items: ProposalItem[];
  notes: string[];
  warnings: string[];
}

/**
 * Validates an AI task proposal against the user's actual data.
 *
 * - Existing task IDs must exist in the user's task list.
 * - Existing task IDs must not be duplicated.
 * - New task fields are already schema-validated before this step.
 *
 * Any invalid existing-task references are filtered out; if the proposal
 * contains no valid items at all, validation fails.
 */
export function validateAiTaskProposal(
  proposal: AiTaskProposal,
  userTasks: AiContextTask[]
): ProposalValidationResult {
  const validTaskIds = new Set(userTasks.map((t) => t.id));
  const seenIds = new Set<string>();
  const items: ProposalItem[] = [];
  const warnings: string[] = [...(proposal.warnings ?? [])];

  for (const item of proposal.items) {
    if (item.type === "existing") {
      if (!validTaskIds.has(item.taskId)) {
        warnings.push(`Ignored reference to unknown task ${item.taskId}.`);
        continue;
      }
      if (seenIds.has(item.taskId)) {
        warnings.push(`Ignored duplicate reference to task ${item.taskId}.`);
        continue;
      }
      seenIds.add(item.taskId);
      items.push(item);
    } else {
      items.push(item);
    }
  }

  return {
    valid: items.length > 0,
    items,
    notes: proposal.notes ?? [],
    warnings,
  };
}
