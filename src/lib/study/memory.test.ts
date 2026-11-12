import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StudyRating } from "@/db/schema";
import { replayMemory, reviewStatus } from "./memory";

const tz = "UTC";
const on = (date: string, rating: StudyRating | null = null, time = "10:00") => ({
  startedAt: new Date(`${date}T${time}:00Z`),
  rating,
});

describe("replayMemory", () => {
  it("returns null without sessions", () => {
    assert.equal(replayMemory([], { timezone: tz }), null);
  });

  it("sets the first interval from the first rating", () => {
    assert.equal(replayMemory([on("2026-11-01", "STRUGGLED")], { timezone: tz })?.intervalDays, 1);
    assert.equal(replayMemory([on("2026-11-01", null)], { timezone: tz })?.intervalDays, 2);
    assert.equal(replayMemory([on("2026-11-01", "OK")], { timezone: tz })?.intervalDays, 2);
    const gotIt = replayMemory([on("2026-11-01", "GOT_IT")], { timezone: tz });
    assert.equal(gotIt?.intervalDays, 4);
    assert.equal(gotIt?.nextReviewOn, "2026-11-05");
    assert.equal(gotIt?.lastStudiedOn, "2026-11-01");
  });

  it("grows the interval with good ratings and resets it after a struggle", () => {
    const state = replayMemory(
      [on("2026-11-01", "GOT_IT"), on("2026-11-05", "GOT_IT"), on("2026-11-15", "OK")],
      { timezone: tz }
    );
    // 4 -> 10 (x2.5) -> 16 (x1.6)
    assert.equal(state?.intervalDays, 16);
    assert.equal(state?.nextReviewOn, "2026-12-01");

    const reset = replayMemory([on("2026-11-01", "GOT_IT"), on("2026-11-05", "GOT_IT"), on("2026-11-15", "STRUGGLED")], {
      timezone: tz,
    });
    assert.equal(reset?.intervalDays, 1);
    assert.equal(reset?.nextReviewOn, "2026-11-16");
    assert.equal(reset?.lastRating, "STRUGGLED");
  });

  it("treats several sessions on one day as one review, using the lowest rating", () => {
    const state = replayMemory(
      [on("2026-11-01", "GOT_IT", "09:00"), on("2026-11-01", "STRUGGLED", "14:00"), on("2026-11-01", "OK", "20:00")],
      { timezone: tz }
    );
    assert.equal(state?.intervalDays, 1);
    assert.equal(state?.reviews, 1);
  });

  it("ignores unrated sessions when the same day has a rating", () => {
    const state = replayMemory([on("2026-11-01", null), on("2026-11-01", "GOT_IT")], { timezone: tz });
    assert.equal(state?.intervalDays, 4);
  });

  it("caps the interval at 60 days", () => {
    const days = ["2026-01-01", "2026-01-05", "2026-01-15", "2026-02-10", "2026-04-15", "2026-08-01"];
    const state = replayMemory(days.map((d) => on(d, "GOT_IT")), { timezone: tz });
    assert.equal(state?.intervalDays, 60);
  });

  it("is order-independent (replays in time order)", () => {
    const a = replayMemory([on("2026-11-05", "OK"), on("2026-11-01", "GOT_IT")], { timezone: tz });
    const b = replayMemory([on("2026-11-01", "GOT_IT"), on("2026-11-05", "OK")], { timezone: tz });
    assert.deepEqual(a, b);
  });

  it("schedules the review before an upcoming exam", () => {
    const state = replayMemory([on("2026-11-01", "GOT_IT"), on("2026-11-05", "GOT_IT")], {
      timezone: tz,
      examDate: "2026-11-09",
    });
    // Would be 10 days (2026-11-15) but the exam is on the 9th: review on the 8th.
    assert.equal(state?.nextReviewOn, "2026-11-08");
  });

  it("reviews the next day when the exam is the day after studying", () => {
    const state = replayMemory([on("2026-11-01", "GOT_IT")], { timezone: tz, examDate: "2026-11-02" });
    assert.equal(state?.nextReviewOn, "2026-11-02");
  });

  it("ignores an exam that has already passed", () => {
    const state = replayMemory([on("2026-11-01", "GOT_IT")], { timezone: tz, examDate: "2026-10-01" });
    assert.equal(state?.nextReviewOn, "2026-11-05");
  });

  it("uses the user's timezone to decide the study day", () => {
    // 23:30 on 1 Nov in Los Angeles is 07:30 on 2 Nov UTC.
    const state = replayMemory([{ startedAt: new Date("2026-11-02T07:30:00Z"), rating: "OK" }], {
      timezone: "America/Los_Angeles",
    });
    assert.equal(state?.lastStudiedOn, "2026-11-01");
    assert.equal(state?.nextReviewOn, "2026-11-03");
  });
});

describe("reviewStatus", () => {
  const state = replayMemory([on("2026-11-01", "OK")], { timezone: tz })!; // due 2026-11-03

  it("is upcoming before the review date", () => {
    assert.deepEqual(reviewStatus(state, "2026-11-02"), { due: false, overdueDays: 0, dueInDays: 1 });
  });

  it("is due on the review date", () => {
    assert.deepEqual(reviewStatus(state, "2026-11-03"), { due: true, overdueDays: 0, dueInDays: 0 });
  });

  it("counts overdue days after it", () => {
    assert.deepEqual(reviewStatus(state, "2026-11-07"), { due: true, overdueDays: 4, dueInDays: -4 });
  });
});
