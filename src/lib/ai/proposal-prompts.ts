export const PROPOSAL_SYSTEM_PROMPT = `You are a task-planning assistant for a daily planner app.

The user will describe what they want to accomplish over a date range. Your job is to propose a set of tasks.

You may:
- Reference existing tasks by their IDs when they are relevant to the user's request.
- Propose brand-new tasks when the user asks for something not already in their list.
- Leave brief, factual reasons for each item.

Rules:
- Do NOT invent tasks the user did not ask for.
- Do NOT invent deadlines unless the user or an existing task provides one.
- Do NOT propose tasks for another user.
- Do NOT reference task IDs that are not listed in the context.
- Do NOT duplicate existing tasks.
- Keep titles concise and actionable.
- Priorities must be LOW, MEDIUM, HIGH, or URGENT.
- Estimated duration must be a positive integer number of minutes, at most 1440 (24 hours).
- Dates and deadlines must be ISO 8601 strings.

Return your response as a JSON object matching the requested schema.`;

export interface ProposalPromptInput {
  currentDate: string;
  currentTime: string;
  timezone: string;
  dateRange: { start: string; end: string };
  request: string;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    estimatedMinutes: number | null;
    deadline: string | null;
  }[];
  availability: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }[];
  existingSchedule: {
    taskId: string;
    startTime: string;
    endTime: string;
  }[];
}

export function buildProposalUserPrompt(input: ProposalPromptInput): string {
  const taskLines = input.tasks
    .map(
      (t) =>
        `- ID ${t.id}: "${t.title}" [${t.priority}, ${t.status}, ${t.estimatedMinutes ?? "unspecified"} min, deadline ${t.deadline ?? "none"}]${t.description ? ` — ${t.description}` : ""}`
    )
    .join("\n");

  const availabilityLines = input.availability
    .map((a) => `- ${a.dayOfWeek}: ${a.startTime}–${a.endTime}`)
    .join("\n");

  const scheduleLines = input.existingSchedule
    .map((s) => `- ${s.taskId}: ${s.startTime} to ${s.endTime}`)
    .join("\n");

  return `Today is ${input.currentDate} at ${input.currentTime} (${input.timezone}).

Planning range: ${input.dateRange.start} to ${input.dateRange.end}.

User request:
"""${input.request}"""

Existing tasks:
${taskLines || "None"}

Availability:
${availabilityLines || "Not configured"}

Existing schedule in this range:
${scheduleLines || "None"}

Propose a set of tasks for this request. For each item choose one of:
1. Existing task: { "type": "existing", "taskId": "...", "reason": "..." }
2. New task: { "type": "new", "title": "...", "description": "...", "priority": "...", "estimatedMinutes": ..., "deadline": "..." | null, "reason": "..." }

Return the result as JSON with top-level keys: items, notes, warnings.`;
}
