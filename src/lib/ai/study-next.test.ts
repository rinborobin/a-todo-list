import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { generateText } from "ai";
import { suggestStudyNextWithAi } from "./study-next-impl";
import { validateStudyNext, type StudyNextAiContext } from "./study-next-schemas";

const context: StudyNextAiContext = {
  currentDate: "2026-11-12",
  timezone: "UTC",
  subjects: [
    {
      id: "calc",
      name: "Calculus",
      minutesLast7Days: 120,
      daysSinceLastStudied: 1,
      latestRating: "OK",
      openTasks: [{ id: "ps4", title: "Problem set 4", deadline: "2026-11-13T23:59:00.000Z", estimatedMinutes: 90 }],
    },
    {
      id: "db",
      name: "Databases",
      minutesLast7Days: 0,
      daysSinceLastStudied: 9,
      latestRating: "STRUGGLED",
      openTasks: [{ id: "lab", title: "Lab report", deadline: null, estimatedMinutes: 60 }],
    },
  ],
};

function fakeGenerateText(output: unknown): typeof generateText {
  return (async () => ({ output })) as unknown as typeof generateText;
}

const fakeModel = {} as Parameters<typeof suggestStudyNextWithAi>[2];

describe("validateStudyNext", () => {
  it("accepts a subject with one of its own open tasks", () => {
    assert.equal(validateStudyNext({ subjectId: "db", taskId: "lab", minutes: 60, reason: "r" }, context).valid, true);
  });

  it("accepts a subject without a task (review)", () => {
    assert.equal(validateStudyNext({ subjectId: "calc", taskId: null, minutes: 45, reason: "r" }, context).valid, true);
  });

  it("rejects an unknown subject, such as another user's", () => {
    const result = validateStudyNext({ subjectId: "someone-elses", taskId: null, minutes: 45, reason: "r" }, context);
    assert.equal(result.valid, false);
  });

  it("rejects a task that is not open or not the user's", () => {
    const result = validateStudyNext({ subjectId: "db", taskId: "other-users-task", minutes: 45, reason: "r" }, context);
    assert.equal(result.valid, false);
  });

  it("rejects a task from a different subject", () => {
    const result = validateStudyNext({ subjectId: "db", taskId: "ps4", minutes: 45, reason: "r" }, context);
    assert.equal(result.valid, false);
  });
});

describe("suggestStudyNextWithAi", () => {
  it("returns a valid suggestion from the model", async () => {
    const result = await suggestStudyNextWithAi(
      context,
      fakeGenerateText({ subjectId: "db", taskId: "lab", minutes: 60, reason: "Not studied for 9 days and it felt hard." }),
      fakeModel
    );
    assert.deepEqual(result, {
      subjectId: "db",
      taskId: "lab",
      minutes: 60,
      reason: "Not studied for 9 days and it felt hard.",
    });
  });

  it("returns null when the model picks a task outside the subject", async () => {
    const result = await suggestStudyNextWithAi(
      context,
      fakeGenerateText({ subjectId: "db", taskId: "ps4", minutes: 60, reason: "x" }),
      fakeModel
    );
    assert.equal(result, null);
  });

  it("returns null when the output does not match the schema", async () => {
    const result = await suggestStudyNextWithAi(
      context,
      fakeGenerateText({ subjectId: "db", minutes: 5000 }),
      fakeModel
    );
    assert.equal(result, null);
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
