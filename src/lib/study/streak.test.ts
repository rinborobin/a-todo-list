import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { practiceStreak } from "./streak";

// Thursday 12 November 2026, 10:00 UTC. The week started Monday 9 November.
const now = new Date("2026-11-12T10:00:00Z");
const on = (date: string, hour = 9) => ({ startedAt: new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`) });
const base = { now, timezone: "UTC" };

describe("practiceStreak", () => {
  it("counts distinct practice days this week, not sessions", () => {
    const s = practiceStreak([on("2026-11-09"), on("2026-11-09", 15), on("2026-11-11")], { ...base, daysPerWeek: 3 });
    assert.equal(s.daysThisWeek, 2);
    assert.equal(s.target, 3);
    assert.equal(s.practicedToday, false);
    // Thursday to Sunday is 4 days left for 1 more day: still slack.
    assert.equal(s.daysLeft, 4);
    assert.equal(s.needed, 1);
    assert.equal(s.onTrack, true);
    assert.equal(s.atRisk, false);
  });

  it("ignores sessions from last week when counting this week", () => {
    const s = practiceStreak([on("2026-11-08"), on("2026-11-07")], { ...base, daysPerWeek: 2 });
    assert.equal(s.daysThisWeek, 0);
  });

  it("is at risk when every remaining day is needed and today is not done yet", () => {
    // 5 a week, 1 done by Thursday: needs Thu, Fri, Sat, Sun.
    const s = practiceStreak([on("2026-11-10")], { ...base, daysPerWeek: 5 });
    assert.equal(s.needed, 4);
    assert.equal(s.atRisk, true);
    assert.equal(s.onTrack, false);
  });

  it("is not at risk once today is done", () => {
    const s = practiceStreak([on("2026-11-10"), on("2026-11-12", 8)], { ...base, daysPerWeek: 5 });
    assert.equal(s.practicedToday, true);
    assert.equal(s.atRisk, false);
  });

  it("counts a daily streak through yesterday until today is practised", () => {
    const days = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"].map((d) => on(d));
    const before = practiceStreak(days, { ...base, daysPerWeek: 7 });
    assert.equal(before.streakDays, 4);
    assert.equal(before.atRisk, true);

    const after = practiceStreak([...days, on("2026-11-12", 8)], { ...base, daysPerWeek: 7 });
    assert.equal(after.streakDays, 5);
    assert.equal(after.atRisk, false);
  });

  it("breaks the daily streak after a missed day", () => {
    const s = practiceStreak([on("2026-11-09"), on("2026-11-10")], { ...base, daysPerWeek: 7 });
    assert.equal(s.streakDays, 0);
    assert.equal(s.atRisk, false);
  });

  it("counts weeks that met the target, plus this week once met", () => {
    const sessions = [
      // Week of 26 Oct: 2 days (target 2, met)
      on("2026-10-27"),
      on("2026-10-29"),
      // Week of 2 Nov: 2 days (met)
      on("2026-11-02"),
      on("2026-11-06"),
      // This week: 1 so far
      on("2026-11-10"),
    ];
    const s = practiceStreak(sessions, { ...base, daysPerWeek: 2 });
    assert.equal(s.streakWeeks, 2);
    const met = practiceStreak([...sessions, on("2026-11-12", 8)], { ...base, daysPerWeek: 2 });
    assert.equal(met.streakWeeks, 3);
  });

  it("stops counting weeks at one that missed the target", () => {
    const s = practiceStreak([on("2026-10-27"), on("2026-10-29"), on("2026-11-03")], { ...base, daysPerWeek: 2 });
    assert.equal(s.streakWeeks, 0);
  });

  it("uses the local day, not UTC", () => {
    // 23:30 UTC on Wednesday is Thursday morning in Kuala Lumpur (UTC+8).
    const s = practiceStreak([{ startedAt: new Date("2026-11-11T23:30:00Z") }], {
      now: new Date("2026-11-12T02:00:00Z"),
      timezone: "Asia/Kuala_Lumpur",
      daysPerWeek: 3,
    });
    assert.equal(s.practicedToday, true);
  });
});
