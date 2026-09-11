import type { Task } from "@/db/schema";
import type { AiPlanSuggestion } from "./schemas";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAiSuggestion(
  suggestion: AiPlanSuggestion,
  tasks: Task[]
): ValidationResult {
  const taskIds = new Set(tasks.map((t) => t.id));
  const orderedIds = suggestion.suggestedOrder;

  // Must contain only provided task IDs.
  for (const id of orderedIds) {
    if (!taskIds.has(id)) {
      return {
        valid: false,
        reason: `Suggested order contains unknown task ID: ${id}`,
      };
    }
  }

  // Must contain exactly the provided task IDs.
  if (orderedIds.length !== tasks.length) {
    return {
      valid: false,
      reason: `Suggested order length (${orderedIds.length}) does not match task count (${tasks.length})`,
    };
  }

  // No duplicates.
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return {
      valid: false,
      reason: "Suggested order contains duplicate task IDs",
    };
  }

  return { valid: true };
}
