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
