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

describe("rankStudyNext v2: coach-created review tasks", () => {
  it("does not repeat a planned review task as a separate deadline reason", () => {
    const ranked = rankStudyNext({
      now,
      timezone: "UTC",
      subjects: [subjects[0]],
      topics: [{ id: "limits", name: "Limits", subjectId: "calc", archivedAt: null }],
      openTasks: [
        task({ id: "rev", subjectId: "calc", title: "Review: Calculus · Limits", deadline: new Date(now.getTime() + 20 * H) }),
      ],
      sessions: [
        session({ subjectId: "calc", topicId: "limits", minutes: 40, startedAt: new Date(now.getTime() - 5 * D), rating: "STRUGGLED" }),
      ],
    });
    assert.equal(ranked[0].topicId, "limits");
    assert.doesNotMatch(ranked[0].reason, /Review:/);
    assert.match(ranked[0].reason, /Limits due for review/);
  });
});

describe("rankStudyNext v3: kinds", () => {
  const base = { now, timezone: "UTC" };
  const daysAgo = (n: number) => new Date(now.getTime() - n * D);
  // Studied yesterday and felt fine: nothing pressing.
  const coveredClass: SubjectLike = { id: "calc", name: "Calculus", archivedAt: null, kind: "CLASS", confidence: "STRONG" };
  const coveredSessions = [
    session({ subjectId: "calc", minutes: 60, startedAt: daysAgo(3), rating: "GOT_IT" }),
    session({ subjectId: "calc", minutes: 60, startedAt: daysAgo(1), rating: "GOT_IT" }),
  ];
  const site: SubjectLike = { id: "site", name: "Portfolio site", archivedAt: null, kind: "PROJECT" };
  const mvp = (targetDate: string | null) => ({
    id: "mvp",
    subjectId: "site",
    name: "MVP",
    targetDate,
    completedAt: null,
    sortOrder: 0,
  });

  it("raises a side project nobody touched for a week above a well-covered class", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [coveredClass, site],
      openTasks: [task({ id: "login", title: "Build login page", subjectId: "site" })],
      sessions: [...coveredSessions, session({ subjectId: "site", minutes: 90, startedAt: daysAgo(7) })],
    });
    assert.equal(ranked[0].subjectId, "site");
    assert.equal(ranked[0].kind, "PROJECT");
    assert.equal(ranked[0].taskTitle, "Build login page");
    assert.match(ranked[0].reason, /not touched for 7 days/);
    assert.equal(ranked[0].reviewOn, null);
  });

  it("never talks about reviews for a project", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [site],
      openTasks: [],
      sessions: [session({ subjectId: "site", minutes: 60, startedAt: daysAgo(20), rating: "STRUGGLED" })],
    });
    assert.doesNotMatch(ranked[0].reason, /review|not studied yet/);
  });

  it("calls an untouched project not started", () => {
    const ranked = rankStudyNext({ ...base, subjects: [site], openTasks: [], sessions: [] });
    assert.match(ranked[0].reason, /not started yet/);
  });

  it("picks the next task of the current milestone and names the milestone", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [site],
      milestones: [mvp(null)],
      openTasks: [
        task({ id: "loose", title: "Write blog post", subjectId: "site", deadline: new Date(now.getTime() + 2 * D) }),
        task({ id: "db", title: "Set up database", subjectId: "site", milestoneId: "mvp" }),
      ],
      sessions: [session({ subjectId: "site", minutes: 60, startedAt: daysAgo(1) })],
    });
    assert.equal(ranked[0].taskId, "db");
    assert.equal(ranked[0].milestoneName, "MVP");
  });

  it("ramps a project up as its milestone date gets close", () => {
    const score = (targetDate: string) =>
      rankStudyNext({
        ...base,
        subjects: [site],
        milestones: [mvp(targetDate)],
        openTasks: [],
        sessions: [session({ subjectId: "site", minutes: 60, startedAt: daysAgo(1) })],
      })[0];
    const far = score("2026-12-02");
    const near = score("2026-11-15");
    assert.ok(near.score > far.score);
    assert.match(near.reason, /MVP due in 3 days/);
  });

  it("puts a class with an exam this week ahead of a neglected project", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [{ ...coveredClass, examDate: "2026-11-16" }, site],
      milestones: [mvp("2026-11-18")],
      openTasks: [task({ id: "login", subjectId: "site", milestoneId: "mvp" })],
      sessions: [...coveredSessions, session({ subjectId: "site", minutes: 90, startedAt: daysAgo(8) })],
    });
    assert.equal(ranked[0].subjectId, "calc");
    assert.match(ranked[0].reason, /exam in 4 days/);
  });

  it("puts a class with an overdue task ahead of a neglected project", () => {
    const ranked = rankStudyNext({
      ...base,
      subjects: [coveredClass, site],
      openTasks: [
        task({ id: "ps5", title: "Problem set 5", subjectId: "calc", deadline: new Date(now.getTime() - 2 * H) }),
        task({ id: "login", subjectId: "site" }),
      ],
      sessions: [...coveredSessions, session({ subjectId: "site", minutes: 90, startedAt: daysAgo(10) })],
    });
    assert.equal(ranked[0].subjectId, "calc");
  });

  describe("self-learning", () => {
    const japanese: SubjectLike = {
      id: "jp",
      name: "Japanese",
      archivedAt: null,
      kind: "SELF_LEARNING",
      practiceDaysPerWeek: 7,
      resourceName: "Genki I",
      resourceUnit: "lesson",
      resourceTotal: 40,
      resourceDone: 18,
    };
    const daily = [4, 3, 2, 1].map((n) => session({ subjectId: "jp", minutes: 20, startedAt: daysAgo(n), rating: "GOT_IT" }));

    it("raises it when the daily streak would break today", () => {
      const ranked = rankStudyNext({ ...base, subjects: [coveredClass, japanese], openTasks: [], sessions: [...coveredSessions, ...daily] });
      assert.equal(ranked[0].subjectId, "jp");
      assert.match(ranked[0].reason, /keep your 4-day streak/);
    });

    it("is quiet once today is practised", () => {
      const today = session({ subjectId: "jp", minutes: 20, startedAt: new Date(now.getTime() - H), rating: "GOT_IT" });
      const ranked = rankStudyNext({ ...base, subjects: [japanese], openTasks: [], sessions: [...daily, today] });
      assert.doesNotMatch(ranked[0].reason, /streak/);
    });

    it("suggests the next lesson when no topic is due", () => {
      const ranked = rankStudyNext({ ...base, subjects: [japanese], openTasks: [], sessions: daily });
      assert.equal(ranked[0].resourceNext, "Lesson 19 of 40");
      assert.equal(ranked[0].topicId, null);
    });

    it("still reviews a due topic before moving on in the book", () => {
      const ranked = rankStudyNext({
        ...base,
        subjects: [japanese],
        topics: [{ id: "kanji", name: "Kanji", subjectId: "jp", archivedAt: null }],
        openTasks: [],
        sessions: [session({ subjectId: "jp", topicId: "kanji", minutes: 20, startedAt: daysAgo(6), rating: "STRUGGLED" })],
      });
      assert.equal(ranked[0].topicName, "Kanji");
      assert.match(ranked[0].reason, /Kanji due for review/);
    });

    it("counts practice days against a weekly target", () => {
      const ranked = rankStudyNext({
        ...base,
        subjects: [{ ...japanese, practiceDaysPerWeek: 5 }],
        openTasks: [],
        // Only Tuesday so far: 4 more days needed with 4 left.
        sessions: [session({ subjectId: "jp", minutes: 20, startedAt: daysAgo(2), rating: "GOT_IT" })],
      });
      assert.match(ranked[0].reason, /1 of 5 days this week/);
    });

    it("mentions a target date that is getting close", () => {
      const ranked = rankStudyNext({
        ...base,
        subjects: [{ ...japanese, practiceDaysPerWeek: null, examDate: "2026-11-20" }],
        openTasks: [],
        sessions: [session({ subjectId: "jp", minutes: 20, startedAt: daysAgo(1), rating: "GOT_IT" })],
      });
      assert.match(ranked[0].reason, /target in 8 days/);
    });
  });
});
