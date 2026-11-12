import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { generateText } from "ai";
import { suggestStudyNextWithAi } from "./study-next-impl";
import { studyNextAiOutputSchema, validateStudyNext, type StudyNextAiContext } from "./study-next-schemas";

const context: StudyNextAiContext = {
  currentDate: "2026-11-12",
  timezone: "UTC",
  habits: { usualStudyHours: [20], estimateRatio: 1.3 },
  subjects: [
    {
      id: "calc",
      name: "Calculus",
      confidence: "WEAK",
      examDate: "2026-11-20",
      weeklyGoalMinutes: 240,
      minutesLast7Days: 120,
      daysSinceLastStudied: 1,
      latestRating: "OK",
      typicalMinutes: 45,
      nextReviewOn: "2026-11-13",
      topics: [
        { id: "limits", name: "Limits", daysSinceStudied: 5, lastRating: "STRUGGLED", nextReviewOn: "2026-11-08", dueForReview: true },
      ],
      openTasks: [{ id: "ps4", title: "Problem set 4", deadline: "2026-11-13T23:59:00.000Z", estimatedMinutes: 90 }],
    },
    {
      id: "db",
      name: "Databases",
      minutesLast7Days: 0,
      daysSinceLastStudied: 9,
      latestRating: "STRUGGLED",
      topics: [{ id: "joins", name: "Joins", daysSinceStudied: 9, lastRating: "STRUGGLED", nextReviewOn: "2026-11-04", dueForReview: true }],
      openTasks: [{ id: "lab", title: "Lab report", deadline: null, estimatedMinutes: 60 }],
    },
  ],
};

const output = (overrides: Record<string, unknown> = {}) => ({
  subjectId: "calc",
  topicId: "limits",
  taskId: null,
  minutes: 45,
  step: "Redo the five limit problems you got wrong last week.",
  reason: "Limits are overdue for review and felt hard.",
  ...overrides,
});

function fakeGenerateText(value: unknown): typeof generateText {
  return (async () => ({ output: value })) as unknown as typeof generateText;
}

const fakeModel = {} as Parameters<typeof suggestStudyNextWithAi>[2];
const parse = (value: Record<string, unknown>) => studyNextAiOutputSchema.parse(value);

describe("validateStudyNext", () => {
  it("accepts a subject with one of its own topics", () => {
    assert.equal(validateStudyNext(parse(output()), context).valid, true);
  });

  it("accepts a subject with one of its own open tasks and no topic", () => {
    assert.equal(validateStudyNext(parse(output({ subjectId: "db", topicId: null, taskId: "lab" })), context).valid, true);
  });

  it("rejects an unknown subject, such as another user's", () => {
    assert.equal(validateStudyNext(parse(output({ subjectId: "someone-elses", topicId: null })), context).valid, false);
  });

  it("rejects a topic from a different subject", () => {
    assert.equal(validateStudyNext(parse(output({ subjectId: "db", topicId: "limits" })), context).valid, false);
  });

  it("rejects a made-up topic", () => {
    assert.equal(validateStudyNext(parse(output({ topicId: "invented" })), context).valid, false);
  });

  it("rejects a task that is not open or not the user's", () => {
    assert.equal(validateStudyNext(parse(output({ taskId: "other-users-task" })), context).valid, false);
  });

  it("rejects a task from a different subject", () => {
    assert.equal(validateStudyNext(parse(output({ subjectId: "db", topicId: null, taskId: "ps4" })), context).valid, false);
  });
});

describe("suggestStudyNextWithAi", () => {
  it("returns a valid suggestion with a concrete step", async () => {
    const result = await suggestStudyNextWithAi(context, fakeGenerateText(output()), fakeModel);
    assert.equal(result?.subjectId, "calc");
    assert.equal(result?.topicId, "limits");
    assert.match(result?.step ?? "", /limit problems/);
  });

  it("returns null when the model picks a topic outside the subject", async () => {
    const result = await suggestStudyNextWithAi(context, fakeGenerateText(output({ subjectId: "db" })), fakeModel);
    assert.equal(result, null);
  });

  it("returns null when the step is missing or too long", async () => {
    assert.equal(await suggestStudyNextWithAi(context, fakeGenerateText(output({ step: undefined })), fakeModel), null);
    assert.equal(await suggestStudyNextWithAi(context, fakeGenerateText(output({ step: "x".repeat(161) })), fakeModel), null);
  });

  it("returns null when the output does not match the schema", async () => {
    assert.equal(await suggestStudyNextWithAi(context, fakeGenerateText({ subjectId: "db", minutes: 5000 }), fakeModel), null);
  });

  it("returns null when the provider fails", async () => {
    const failing = (async () => {
      throw new Error("timeout");
    }) as unknown as typeof generateText;
    assert.equal(await suggestStudyNextWithAi(context, failing, fakeModel), null);
  });

  it("returns null when there are no subjects, without calling the model", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return { output: null };
    }) as unknown as typeof generateText;
    assert.equal(await suggestStudyNextWithAi({ ...context, subjects: [] }, spy, fakeModel), null);
    assert.equal(called, false);
  });
});
