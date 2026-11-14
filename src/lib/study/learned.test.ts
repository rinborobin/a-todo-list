import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLearned } from "./learned";

const now = new Date("2026-11-12T10:00:00Z");
const D = 86_400_000;
const ago = (days: number) => new Date(now.getTime() - days * D);

describe("buildLearned", () => {
  const subjects = [
    { id: "calc", name: "Calculus", archivedAt: null },
    { id: "db", name: "Databases", archivedAt: null },
  ];
  const topics = [{ id: "limits", name: "Limits", subjectId: "calc", archivedAt: null }];

  it("lists topics due soon and subjects studied without topics, soonest first", () => {
    const learned = buildLearned({
      subjects,
      topics,
      sessions: [
        { subjectId: "calc", topicId: "limits", startedAt: ago(4), minutes: 40, rating: "STRUGGLED", source: "TIMER" },
        { subjectId: "db", topicId: null, startedAt: ago(1), minutes: 30, rating: "GOT_IT", source: "BLOCK" },
      ],
      finishedTaskEstimates: [],
      timezone: "UTC",
      now,
    });
    assert.deepEqual(
      learned.reviewQueue.map((r) => [r.subjectName, r.topicName, r.overdueDays, r.dueInDays]),
      [
        ["Calculus", "Limits", 3, -3],
        ["Databases", null, 0, 3],
      ]
    );
  });

  it("leaves reviews more than a week away out of the queue", () => {
    const learned = buildLearned({
      subjects: [subjects[0]],
      topics: [],
      sessions: [
        { subjectId: "calc", startedAt: ago(30), minutes: 30, rating: "GOT_IT", source: "TIMER" },
        { subjectId: "calc", startedAt: ago(26), minutes: 30, rating: "GOT_IT", source: "TIMER" },
        { subjectId: "calc", startedAt: ago(16), minutes: 30, rating: "GOT_IT", source: "TIMER" },
      ],
      finishedTaskEstimates: [],
      timezone: "UTC",
      now,
    });
    // Intervals 4 -> 10 -> 25: next review is 9 days away.
    assert.equal(learned.reviewQueue.length, 0);
    assert.deepEqual(learned.typicalBySubject, [{ subjectName: "Calculus", minutes: 30 }]);
  });

  it("reports nothing learned for a new user", () => {
    const learned = buildLearned({ subjects, topics, sessions: [], finishedTaskEstimates: [], timezone: "UTC", now });
    assert.equal(learned.sessionsCount, 0);
    assert.deepEqual(learned.reviewQueue, []);
    assert.deepEqual(learned.usualHours, []);
    assert.equal(learned.estimateRatio, null);
  });
});

describe("buildLearned: kinds", () => {
  const base = { topics: [], finishedTaskEstimates: [], timezone: "UTC", now };

  it("keeps projects out of the review queue and tracks when they were last touched", () => {
    const learned = buildLearned({
      ...base,
      subjects: [
        { id: "site", name: "Portfolio site", archivedAt: null, kind: "PROJECT" as const },
        { id: "app", name: "Habit app", archivedAt: null, kind: "PROJECT" as const },
      ],
      sessions: [
        { subjectId: "site", topicId: null, startedAt: ago(9), minutes: 60, rating: "STRUGGLED", source: "TIMER" },
        { subjectId: "site", topicId: null, startedAt: ago(5), minutes: 60, rating: null, source: "TIMER" },
      ],
    });
    assert.equal(learned.reviewQueue.length, 0);
    assert.deepEqual(learned.projects, [
      { subjectName: "Habit app", idleDays: null },
      { subjectName: "Portfolio site", idleDays: 5 },
    ]);
  });

  it("describes the practice rhythm of self-learning", () => {
    const learned = buildLearned({
      ...base,
      subjects: [
        { id: "jp", name: "Japanese", archivedAt: null, kind: "SELF_LEARNING" as const, practiceDaysPerWeek: 7 },
        { id: "rust", name: "Rust", archivedAt: null, kind: "SELF_LEARNING" as const, practiceDaysPerWeek: 3 },
        { id: "piano", name: "Piano", archivedAt: null, kind: "SELF_LEARNING" as const },
      ],
      sessions: [
        { subjectId: "jp", topicId: null, startedAt: ago(2), minutes: 20, rating: "OK", source: "TIMER" },
        { subjectId: "jp", topicId: null, startedAt: ago(1), minutes: 20, rating: "OK", source: "TIMER" },
        { subjectId: "rust", topicId: null, startedAt: ago(1), minutes: 45, rating: "OK", source: "TIMER" },
      ],
    });
    assert.deepEqual(learned.practice, [
      { subjectName: "Japanese", line: "keep your 2-day streak" },
      { subjectName: "Rust", line: "1 of 3 days this week" },
    ]);
    // Self-learning still gets reviews.
    assert.ok(learned.reviewQueue.some((r) => r.subjectName === "Japanese"));
  });
});

describe("buildLearned: finished tasks", () => {
  it("uses a finished project task for last touched", () => {
    const learned = buildLearned({
      subjects: [{ id: "site", name: "Portfolio site", archivedAt: null, kind: "PROJECT" as const }],
      topics: [],
      sessions: [],
      finishedTasks: [{ subjectId: "site", finishedAt: ago(2) }],
      finishedTaskEstimates: [],
      timezone: "UTC",
      now,
    });
    assert.deepEqual(learned.projects, [{ subjectName: "Portfolio site", idleDays: 2 }]);
  });
});

describe("buildLearned: next topics", () => {
  it("names the next topic to learn per subject, skipping studied ones", () => {
    const learned = buildLearned({
      subjects: [{ id: "web", name: "Web Dev", archivedAt: null }],
      topics: [
        { id: "flex", name: "Flexbox", subjectId: "web", archivedAt: null, position: 0 },
        { id: "grid", name: "CSS Grid", subjectId: "web", archivedAt: null, position: 1 },
      ],
      sessions: [{ subjectId: "web", topicId: "flex", startedAt: ago(1), minutes: 30, rating: "GOT_IT", source: "TIMER" }],
      finishedTaskEstimates: [],
      timezone: "UTC",
      now,
    });
    assert.deepEqual(learned.nextTopics, [{ subjectName: "Web Dev", topicName: "CSS Grid" }]);
  });
});
