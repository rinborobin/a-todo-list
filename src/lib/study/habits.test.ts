import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateRatio, typicalMinutes, usualHours } from "./habits";

describe("typicalMinutes", () => {
  it("needs at least three timer sessions", () => {
    assert.equal(
      typicalMinutes([
        { minutes: 40, source: "TIMER" },
        { minutes: 50, source: "TIMER" },
      ]),
      null
    );
  });

  it("uses the median timer session, rounded to 5 minutes", () => {
    assert.equal(
      typicalMinutes([
        { minutes: 38, source: "TIMER" },
        { minutes: 52, source: "TIMER" },
        { minutes: 47, source: "TIMER" },
        { minutes: 200, source: "TIMER" },
      ]),
      50 // median of 38, 47, 52, 200 = 49.5 -> 50
    );
  });

  it("ignores planned blocks and manual logs", () => {
    assert.equal(
      typicalMinutes([
        { minutes: 30, source: "TIMER" },
        { minutes: 30, source: "TIMER" },
        { minutes: 120, source: "BLOCK" },
        { minutes: 120, source: "MANUAL" },
      ]),
      null
    );
  });
});

describe("usualHours", () => {
  const at = (iso: string, source: "TIMER" | "BLOCK" | "MANUAL" = "TIMER") => ({ startedAt: new Date(iso), source });

  it("returns the most common start hours with at least two sessions, busiest first", () => {
    const hours = usualHours(
      [
        at("2026-11-01T20:10:00Z"),
        at("2026-11-02T20:40:00Z"),
        at("2026-11-03T20:05:00Z"),
        at("2026-11-04T09:00:00Z"),
        at("2026-11-05T09:30:00Z"),
        at("2026-11-06T14:00:00Z"),
      ],
      "UTC"
    );
    assert.deepEqual(hours, [20, 9]);
  });

  it("uses the user's timezone and skips manual logs", () => {
    const hours = usualHours(
      [
        at("2026-11-02T04:00:00Z"), // 20:00 Los Angeles
        at("2026-11-03T04:30:00Z"),
        at("2026-11-04T04:00:00Z", "MANUAL"),
        at("2026-11-05T04:00:00Z", "MANUAL"),
      ],
      "America/Los_Angeles"
    );
    assert.deepEqual(hours, [20]);
  });

  it("returns nothing without enough sessions", () => {
    assert.deepEqual(usualHours([at("2026-11-01T20:00:00Z")], "UTC"), []);
  });
});

describe("estimateRatio", () => {
  it("needs at least three finished tasks with estimates", () => {
    assert.equal(
      estimateRatio([
        { estimatedMinutes: 60, actualMinutes: 90 },
        { estimatedMinutes: 30, actualMinutes: 45 },
      ]),
      null
    );
  });

  it("returns the median actual / estimate ratio", () => {
    assert.equal(
      estimateRatio([
        { estimatedMinutes: 60, actualMinutes: 90 }, // 1.5
        { estimatedMinutes: 30, actualMinutes: 39 }, // 1.3
        { estimatedMinutes: 60, actualMinutes: 60 }, // 1.0
        { estimatedMinutes: 0, actualMinutes: 60 }, // ignored
      ]),
      1.3
    );
  });
});
