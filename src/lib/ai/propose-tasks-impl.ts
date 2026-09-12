import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import type { AiTaskProposalContext, AiTaskProposalResult } from "./proposal-schemas";
import { aiTaskProposalSchema } from "./proposal-schemas";
import type { ProposalPromptInput } from "./proposal-prompts";
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt } from "./proposal-prompts";
import { validateAiTaskProposal } from "./proposal-validate";

export async function generateAiTaskProposal(
  context: AiTaskProposalContext,
  generateTextFn: typeof generateText,
  model: LanguageModel
): Promise<AiTaskProposalResult | null> {
  try {
    const promptInput = buildProposalPromptInput(context);
    const result = await generateTextFn({
      model,
      system: PROPOSAL_SYSTEM_PROMPT,
      prompt: buildProposalUserPrompt(promptInput),
      output: Output.object({ schema: aiTaskProposalSchema }),
    });

    const proposal = aiTaskProposalSchema.parse(result.output);
    const validated = validateAiTaskProposal(proposal, context.tasks);

    if (!validated.valid) {
      return null;
    }

    return {
      items: validated.items,
      notes: validated.notes,
      warnings: validated.warnings,
    };
  } catch {
    // Any failure (provider error, timeout, malformed output, validation
    // failure) results in a silent null so the UI can show a fallback.
    return null;
  }
}

function buildProposalPromptInput(context: AiTaskProposalContext): ProposalPromptInput {
  return {
    currentDate: context.currentDate,
    currentTime: context.currentTime,
    timezone: context.timezone,
    dateRange: context.dateRange,
    request: context.request,
    tasks: context.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      estimatedMinutes: t.estimatedMinutes,
      deadline: t.deadline,
    })),
    availability: context.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    existingSchedule: context.existingSchedule.map((s) => ({
      taskId: s.taskId,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
}
