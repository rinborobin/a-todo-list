import { generateText, Output } from "ai";
import type { AiPlanResult, AiPlanningContext } from "./schemas";
import { aiPlanSuggestionSchema } from "./schemas";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { validateAiSuggestion } from "./validate";
import type { LanguageModel } from "ai";

export async function suggestAiPlanOrdering(
  context: AiPlanningContext,
  generateTextFn: typeof generateText,
  model: LanguageModel
): Promise<AiPlanResult | null> {
  try {
    const promptInput = buildAiPlanInput(context);
    const result = await generateTextFn({
      model,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(promptInput),
      output: Output.object({ schema: aiPlanSuggestionSchema }),
    });

    const suggestion = aiPlanSuggestionSchema.parse(result.output);
    const validation = validateAiSuggestion(suggestion, context.tasks);
    if (!validation.valid) {
      return null;
    }

    return {
      suggestedOrder: suggestion.suggestedOrder,
      notes: suggestion.notes ?? [],
      warnings: suggestion.warnings ?? [],
      aiGenerated: true,
    };
  } catch {
    // Any failure (provider error, timeout, invalid output, etc.) results in a
    // silent fallback to deterministic scheduling.
    return null;
  }
}

function buildAiPlanInput(context: AiPlanningContext) {
  const {
    tasks,
    availability,
    existingItems,
    deterministicSchedule,
    unscheduledTasks,
    timezone,
    startDate,
    endDate,
    now,
  } = context;

  return {
    currentDate: toDateString(now),
    currentTime: toTimeString(now),
    timezone,
    dateRange: { start: startDate, end: endDate },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status as "TODO" | "IN_PROGRESS",
      estimatedMinutes: task.estimatedMinutes ?? 0,
      deadline: task.deadline?.toISOString() ?? null,
    })),
    availability: availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    existingSchedule: existingItems.map((item) => ({
      taskId: item.taskId,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
    })),
    deterministicSchedule: deterministicSchedule.map((item) => ({
      taskId: item.taskId,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
    })),
    unscheduledTasks,
  };
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
