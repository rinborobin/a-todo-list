import "server-only";

import { createGoogle } from "@ai-sdk/google";
import { env } from "@/lib/env";

export const geminiModel = createGoogle({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
})("gemini-3.6-flash");
