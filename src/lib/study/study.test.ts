import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dailyTotals, summarizeStudy, type SessionLike } from "./stats";
import { rankStudyNext, type SubjectLike, type TaskLike } from "./next";

// Thursday 12 November 2026, 10:00 UTC
const now = new Date("2026-11-12T10:00:00Z");
const H = 3_600_000;
const D = 24 * H;

function session(overrides: Partial<SessionLike> & { minutes: number; startedAt: Date }): SessionLike {
  return { subjectId: "calc", rating: null, ...overrides };
}

const subjects: SubjectLike[] = [
  { id: "calc", name: "Calculus", archivedAt: null },
  { id: "db", name: "Databases", archivedAt: null },
  { id: "os", name: "Operating Systems", archivedAt: null },
];

function task(overrides: Partial<TaskLike> & { id: string; subjectId: string | null }): TaskLike {
  return { title: overrides.id, deadline: null, estimatedMinutes: 60, ...overrides };
}

describe("summarizeStudy", () => {
  it("totals the last 7 days per subject and ignores older sessions", () => {
    const summary = summarizeStudy(
      [
        session({ subjectId: "calc", minutes: 60, startedAt: new Date(now.getTime() - 1 * D) }),
        session({ subjectId: "calc", minutes: 30, startedAt: new Date(now.getTime() - 2 * D) }),
        session({ subjectId: "db", minutes: 45, startedAt: new Date(now.getTime() - 3 * D) }),
        session({ subjectId: "db", minutes: 120, startedAt: new Date(now.getTime() - 9 * D) }),
      ],
      now
    );
    assert.equal(summary.totalMinutes7d, 135);
    assert.equal(summary.bySubject.get("calc")?.minutes7d, 90);
    assert.equal(summary.bySubject.get("db")?.minutes7d, 45);
  });

  it("tracks the last studied time over the whole history given", () => {
    const summary = summarizeStudy(
      [
        session({ subjectId: "db", minutes: 30, startedAt: new Date(now.getTime() - 9 * D) }),
        session({ subjectId: "db", minutes: 30, startedAt: new Date(now.getTime() - 12 * D) }),
      ],
      now
    );
    assert.equal(summary.bySubject.get("db")?.minutes7d, 0);
    assert.equal(summary.bySubject.get("db")?.lastStudiedAt?.toISOString(), new Date(now.getTime() - 9 * D).toISOString());
  });

  it("uses the most recent rated session as the latest rating", () => {
    const summary = summarizeStudy(
      [
        session({ minutes: 30, startedAt: new Date(now.getTime() - 1 * H), rating: null }),
        session({ minutes: 30, startedAt: new Date(now.getTime() - 1 * D), rating: "STRUGGLED" }),
        session({ minutes: 30, startedAt: new Date(now.getTime() - 3 * D), rating: "GOT_IT" }),
      ],
      now
    );
    assert.equal(summary.bySubject.get("calc")?.latestRating, "STRUGGLED");
  });

  it("groups sessions without a subject under null", () => {
    const summary = summarizeStudy([session({ subjectId: null, minutes: 20, startedAt: now })], now);
    assert.equal(summary.bySubject.get(null)?.minutes7d, 20);
  });
});

describe("dailyTotals", () => {
  it("buckets minutes by local date, oldest first, including empty days", () => {
    const totals = dailyTotals(
      [
        // 23:30 on 11 Nov in Los Angeles is 07:30 on 12 Nov UTC.
        session({ minutes: 40, startedAt: new Date("2026-11-12T07:30:00Z") }),
        session({ minutes: 20, startedAt: new Date("2026-11-12T09:00:00Z") }),
      ],
      now,
      "America/Los_Angeles",
      3
    );
    assert.deepEqual(totals, [
      { date: "2026-11-10", minutes: 0 },
      { date: "2026-11-11", minutes: 40 },
      { date: "2026-11-12", minutes: 20 },
    ]);
  });
});

describe("rankStudyNext", () => {
  const base = { subjects, now, timezone: "UTC" };

  it("returns nothing when there are no active subjects", () => {
    assert.deepEqual(rankStudyNext({ ...base, subjects: [], openTasks: [], sessions: [] }), []);
  });

  it("puts a subject with a deadline tomorrow ahead of one that was simply not studied for a while", () => {
    const ranked = rankStudyNext({
      ...base,
      openTasks: [task({ id: "ps4", subjectId: "calc", deadline: new Date(now.getTime() + 1 * D) })],
      sessions: [
        session({ subjectId: "calc", minutes: 60, startedAt: new Date(now.getTime() - 2 * H) }),
        session({ subjectId: "db", minutes: 60, startedAt: new Date(now.getTime() - 10 * D) }),
        session({ subjectId: "os", minutes: 60, startedAt: new Date(now.getTime() - 1 * D) }),
      ],
    });
    assert.equal(ranked[0]?.subjectId, "calc");
    assert.equal(ranked[0]?.taskId, "ps4");
  });

  it("without deadlines, suggests the subject left alone the longest", () => {
    const ranked = rankStudyNext({
      ...base,
      openTasks: [],
      sessions: [
        session({ subjectId: "calc", minutes: 60, startedAt: new Date(now.getTime() - 1 * D) }),
        session({ subjectId: "db", minutes: 60, startedAt: new Date(now.getTime() - 8 * D) }),
        session({ subjectId: "os", minutes: 60, startedAt: new Date(now.getTime() - 3 * D) }),
      ],
    });
    assert.deepEqual(
      ranked.map((r) => r.subjectId),
      ["db", "os", "calc"]
    );
  });

  it("raises a subject whose last session was rated as a struggle", () => {
    const sessions = [
      session({ subjectId: "calc", minutes: 60, startedAt: new Date(now.getTime() - 2 * D), rating: "STRUGGLED" }),
      session({ subjectId: "db", minutes: 60, startedAt: new Date(now.getTime() - 2 * D), rating: "GOT_IT" }),
      session({ subjectId: "os", minutes: 60, startedAt: new Date(now.getTime() - 2 * D) }),
    ];
    const ranked = rankStudyNext({ ...base, openTasks: [], sessions });
    assert.equal(ranked[0]?.subjectId, "calc");
    assert.match(ranked[0]?.reason ?? "", /hard/);
  });

  it("skips archived subjects", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [...subjects.slice(0, 2), { id: "os", name: "Operating Systems", archivedAt: new Date() }],
      openTasks: [],
      sessions: [],
    });
    assert.deepEqual(ranked.map((r) => r.subjectId).sort(), ["calc", "db"]);
  });

  it("suggests the open task with the nearest deadline and its estimate", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [subjects[1]],
      openTasks: [
        task({ id: "later", subjectId: "db", deadline: new Date(now.getTime() + 6 * D), estimatedMinutes: 30 }),
        task({ id: "soon", subjectId: "db", deadline: new Date(now.getTime() + 2 * D), estimatedMinutes: 90 }),
        task({ id: "none", subjectId: "db" }),
      ],
      sessions: [],
    });
    assert.equal(ranked[0]?.taskId, "soon");
    assert.equal(ranked[0]?.minutes, 90);
    assert.match(ranked[0]?.reason ?? "", /soon due Sat/);
    assert.match(ranked[0]?.reason ?? "", /not studied yet/);
  });

  it("falls back to a 1 hour review when the subject has no open tasks", () => {
    const ranked = rankStudyNext({ ...base, subjects: [subjects[0]], openTasks: [], sessions: [] });
    assert.equal(ranked[0]?.taskId, null);
    assert.equal(ranked[0]?.minutes, 60);
  });

  it("mentions an overdue task", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [subjects[0]],
      openTasks: [task({ id: "quiz", subjectId: "calc", deadline: new Date(now.getTime() - 5 * H) })],
      sessions: [],
    });
    assert.match(ranked[0]?.reason ?? "", /quiz is overdue/);
  });
});

describe("rankStudyNext v2: learning", () => {
  const base = { now, timezone: "UTC" };
  const daysAgo = (n: number) => new Date(now.getTime() - n * D);

  it("for a brand-new user with only subjects, puts weak subjects first", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [
        { id: "calc", name: "Calculus", archivedAt: null, confidence: "STRONG" },
        { id: "db", name: "Databases", archivedAt: null, confidence: "WEAK" },
        { id: "os", name: "Operating Systems", archivedAt: null, confidence: "OK" },
      ],
      openTasks: [],
      sessions: [],
    });
    assert.deepEqual(ranked.map((r) => r.subjectId), ["db", "os", "calc"]);
    assert.match(ranked[0].reason, /weak/);
  });

  it("suggests the topic that is due for review, inside the subject", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: subjects.slice(0, 2),
      topics: [
        { id: "limits", name: "Limits", subjectId: "calc", archivedAt: null },
        { id: "series", name: "Series", subjectId: "calc", archivedAt: null },
        { id: "joins", name: "Joins", subjectId: "db", archivedAt: null },
      ],
      openTasks: [],
      sessions: [
        session({ subjectId: "calc", topicId: "limits", minutes: 40, startedAt: daysAgo(5), rating: "STRUGGLED" }),
        session({ subjectId: "calc", topicId: "series", minutes: 40, startedAt: daysAgo(1), rating: "GOT_IT" }),
        session({ subjectId: "db", topicId: "joins", minutes: 40, startedAt: daysAgo(1), rating: "GOT_IT" }),
      ],
    });
    assert.equal(ranked[0].subjectId, "calc");
    assert.equal(ranked[0].topicId, "limits");
    assert.equal(ranked[0].topicName, "Limits");
    assert.match(ranked[0].reason, /Limits due for review/);
  });

  it("ramps up a subject as its exam gets close", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [
        { id: "calc", name: "Calculus", archivedAt: null },
        { id: "os", name: "Operating Systems", archivedAt: null, examDate: "2026-11-15" },
      ],
      openTasks: [],
      sessions: [
        session({ subjectId: "calc", minutes: 60, startedAt: daysAgo(6) }),
        session({ subjectId: "os", minutes: 60, startedAt: daysAgo(1), rating: "GOT_IT" }),
      ],
    });
    assert.equal(ranked[0].subjectId, "os");
    assert.match(ranked[0].reason, /exam in 3 days/);
  });

  it("raises a subject that is behind its weekly goal", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [
        { id: "calc", name: "Calculus", archivedAt: null, weeklyGoalMinutes: 240 },
        { id: "db", name: "Databases", archivedAt: null, weeklyGoalMinutes: 60 },
      ],
      openTasks: [],
      sessions: [
        session({ subjectId: "calc", minutes: 30, startedAt: daysAgo(1), rating: "GOT_IT" }),
        session({ subjectId: "db", minutes: 60, startedAt: daysAgo(1), rating: "GOT_IT" }),
      ],
    });
    assert.equal(ranked[0].subjectId, "calc");
    assert.match(ranked[0].reason, /30m of 4h this week/);
  });

  it("uses the learned session length when there is enough timer history", () => {
    const timer = (n: number) => session({ subjectId: "calc", minutes: 45, startedAt: daysAgo(n), source: "TIMER" });
    const ranked = rankStudyNext({
      ...base,
      subjects: [subjects[0]],
      openTasks: [task({ id: "ps4", subjectId: "calc", estimatedMinutes: 120 })],
      sessions: [timer(2), timer(4), timer(6)],
    });
    assert.equal(ranked[0].minutes, 45);
  });

  it("ignores archived topics", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [subjects[0]],
      topics: [{ id: "old", name: "Old topic", subjectId: "calc", archivedAt: new Date() }],
      openTasks: [],
      sessions: [session({ subjectId: "calc", topicId: "old", minutes: 30, startedAt: daysAgo(9), rating: "STRUGGLED" })],
    });
    assert.equal(ranked[0].topicId, null);
  });
});
