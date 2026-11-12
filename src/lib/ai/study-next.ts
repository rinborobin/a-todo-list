import "server-only";

import { generateText } from "ai";
import { geminiModel } from "./provider";
import { suggestStudyNextWithAi as impl } from "./study-next-impl";
import type { StudyNextAiContext, StudyNextAiOutput } from "./study-next-schemas";

export async function suggestStudyNextWithAi(context: StudyNextAiContext): Promise<StudyNextAiOutput | null> {
  return impl(context, generateText, geminiModel);
}
