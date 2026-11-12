import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeFocusTime, defaultGoalMinutes, formatTimer } from "./focus-time";

const start = new Date("2026-11-12T10:00:00Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("computeFocusTime", () => {
  it("counts elapsed and remaining time against the goal", () => {
    const t = computeFocusTime(start, at(12 * 60 + 34), 60);
    assert.equal(t.elapsedSec, 754);
    assert.equal(t.leftSec, 3600 - 754);
    assert.equal(t.overSec, 0);
    assert.equal(t.goalReached, false);
    assert.ok(Math.abs(t.fractionLeft - (3600 - 754) / 3600) < 1e-9);
  });

  it("reports overtime once the goal has passed", () => {
    const t = computeFocusTime(start, at(3600 + 135), 60);
    assert.equal(t.leftSec, 0);
    assert.equal(t.overSec, 135);
    assert.equal(t.goalReached, true);
    assert.equal(t.fractionLeft, 0);
  });

  it("never goes negative when the device clock is slightly behind", () => {
    const t = computeFocusTime(start, at(-3), 45);
    assert.equal(t.elapsedSec, 0);
    assert.equal(t.leftSec, 45 * 60);
    assert.equal(t.fractionLeft, 1);
  });

  it("uses whole seconds", () => {
    const t = computeFocusTime(start, new Date(start.getTime() + 1999), 25);
    assert.equal(t.elapsedSec, 1);
  });
});

describe("formatTimer", () => {
  it("shows minutes and seconds under an hour", () => {
    assert.equal(formatTimer(0), "00:00");
    assert.equal(formatTimer(754), "12:34");
    assert.equal(formatTimer(3599), "59:59");
  });

  it("adds hours from one hour up", () => {
    assert.equal(formatTimer(3600), "1:00:00");
    assert.equal(formatTimer(2 * 3600 + 5 * 60 + 9), "2:05:09");
  });

  it("treats negative input as zero", () => {
    assert.equal(formatTimer(-20), "00:00");
  });
});

describe("defaultGoalMinutes", () => {
  it("uses the task estimate", () => {
    assert.equal(defaultGoalMinutes(90), 90);
  });

  it("falls back to an hour", () => {
    assert.equal(defaultGoalMinutes(null), 60);
    assert.equal(defaultGoalMinutes(undefined), 60);
  });

  it("keeps the goal between 5 minutes and 8 hours", () => {
    assert.equal(defaultGoalMinutes(2), 5);
    assert.equal(defaultGoalMinutes(1000), 480);
  });
});
