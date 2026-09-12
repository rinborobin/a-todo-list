import "server-only";

import { generateText } from "ai";
import { geminiModel } from "./provider";
import { generateAiTaskProposal as generateAiTaskProposalImpl } from "./propose-tasks-impl";
import type { AiTaskProposalContext, AiTaskProposalResult } from "./proposal-schemas";

export async function generateAiTaskProposal(
  context: AiTaskProposalContext
): Promise<AiTaskProposalResult | null> {
  return generateAiTaskProposalImpl(context, generateText, geminiModel);
}
