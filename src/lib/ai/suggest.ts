import "server-only";

import { generateText } from "ai";
import { geminiModel } from "./provider";
import { suggestAiPlanOrdering as suggestAiPlanOrderingImpl } from "./suggest-impl";
import type { AiPlanResult, AiPlanningContext } from "./schemas";

export async function suggestAiPlanOrdering(
  context: AiPlanningContext
): Promise<AiPlanResult | null> {
  return suggestAiPlanOrderingImpl(context, generateText, geminiModel);
}
