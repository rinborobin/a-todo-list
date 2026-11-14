import "server-only";

import { generateText } from "ai";
import { geminiModel } from "./provider";
import { readOutlineWithAi as readImpl } from "./outline-impl";
import { suggestNextTopicWithAi as nextImpl } from "./next-topic-impl";
import type { OutlineSource, OutlineTopic } from "./outline-schemas";
import type { NextTopicAiContext } from "./next-topic-schemas";

export async function readOutlineWithAi(
  source: OutlineSource,
  context: { subjectName: string; today: string }
): Promise<OutlineTopic[] | null> {
  return readImpl(source, context, generateText, geminiModel);
}

export async function suggestNextTopicWithAi(context: NextTopicAiContext): Promise<{ name: string; reason: string } | null> {
  return nextImpl(context, generateText, geminiModel);
}
