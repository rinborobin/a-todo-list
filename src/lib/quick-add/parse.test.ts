import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "./parse";

// Wednesday 11 November 2026, 10:00 UTC.
const now = new Date("2026-11-11T10:00:00Z");
const utc = { now, timezone: "UTC" };

function deadlineOf(input: string, options = utc): string | null {
  return parseQuickAdd(input, options).deadline?.toISOString() ?? null;
}

describe("parseQuickAdd", () => {
  it("parses title, weekday, time and duration together", () => {
    const result = parseQuickAdd("db essay due fri 5pm 2h", utc);
    assert.equal(result.title, "Db essay");
    assert.equal(result.deadline?.toISOString(), "2026-11-13T17:00:00.000Z");
    assert.equal(result.estimatedMinutes, 120);
    assert.equal(result.estimateIsDefault, false);
    assert.equal(result.priority, "MEDIUM");
  });

  it("keeps plain text as the title with a default 1h estimate and no deadline", () => {
    const result = parseQuickAdd("read ch 7", utc);
    assert.equal(result.title, "Read ch 7");
    assert.equal(result.deadline, null);
    assert.equal(result.estimatedMinutes, 60);
    assert.equal(result.estimateIsDefault, true);
  });

  it("uses 23:59 when a date has no time", () => {
    assert.equal(deadlineOf("calculus ps4 tomorrow"), "2026-11-12T23:59:00.000Z");
    assert.equal(deadlineOf("calculus ps4 tmr"), "2026-11-12T23:59:00.000Z");
    assert.equal(deadlineOf("calculus ps4 today"), "2026-11-11T23:59:00.000Z");
  });

  it("parses day-month and month-day dates", () => {
    assert.equal(deadlineOf("lab report by 13 nov"), "2026-11-13T23:59:00.000Z");
    assert.equal(deadlineOf("lab report by nov 13"), "2026-11-13T23:59:00.000Z");
    assert.equal(deadlineOf("lab report november 20"), "2026-11-20T23:59:00.000Z");
  });

  it("rolls a month-day date that already passed into next year", () => {
    assert.equal(deadlineOf("exam jan 5"), "2027-01-05T23:59:00.000Z");
  });

  it("puts a time without a date today, or tomorrow when it has passed", () => {
    assert.equal(deadlineOf("seminar notes 3pm"), "2026-11-11T15:00:00.000Z");
    assert.equal(deadlineOf("call home 9am"), "2026-11-12T09:00:00.000Z");
    assert.equal(deadlineOf("seminar notes 17:00"), "2026-11-11T17:00:00.000Z");
  });

  it("handles 12am, 12pm and minutes in am/pm times", () => {
    assert.equal(deadlineOf("thing fri 12pm"), "2026-11-13T12:00:00.000Z");
    assert.equal(deadlineOf("thing fri 12am"), "2026-11-13T00:00:00.000Z");
    assert.equal(deadlineOf("thing fri 5:30pm"), "2026-11-13T17:30:00.000Z");
  });

  it("treats the current weekday as today and 'next' as the following one", () => {
    assert.equal(deadlineOf("quiz wed"), "2026-11-11T23:59:00.000Z");
    assert.equal(deadlineOf("quiz next wed"), "2026-11-18T23:59:00.000Z");
    assert.equal(deadlineOf("quiz monday"), "2026-11-16T23:59:00.000Z");
  });

  it("parses relative days", () => {
    assert.equal(deadlineOf("project in 3 days"), "2026-11-14T23:59:00.000Z");
    assert.equal(deadlineOf("project in 1 day"), "2026-11-12T23:59:00.000Z");
  });

  it("parses duration formats", () => {
    assert.equal(parseQuickAdd("essay 1h30", utc).estimatedMinutes, 90);
    assert.equal(parseQuickAdd("essay 1h 30m", utc).estimatedMinutes, 90);
    assert.equal(parseQuickAdd("essay 1.5h", utc).estimatedMinutes, 90);
    assert.equal(parseQuickAdd("essay 45 min", utc).estimatedMinutes, 45);
    assert.equal(parseQuickAdd("essay 2 hours", utc).estimatedMinutes, 120);
    assert.equal(parseQuickAdd("essay 90m", utc).estimatedMinutes, 90);
  });

  it("caps durations at 24 hours", () => {
    assert.equal(parseQuickAdd("essay 30h", utc).estimatedMinutes, 1440);
  });

  it("parses priority markers", () => {
    const high = parseQuickAdd("essay !", utc);
    assert.equal(high.priority, "HIGH");
    assert.equal(high.title, "Essay");

    const urgent = parseQuickAdd("urgent fix bug", utc);
    assert.equal(urgent.priority, "URGENT");
    assert.equal(urgent.title, "Fix bug");

    assert.equal(parseQuickAdd("fix bug !!", utc).priority, "URGENT");
  });

  it("does not treat parts of words as keywords", () => {
    const result = parseQuickAdd("summary of thursdays lecture", utc);
    assert.equal(result.title, "Summary of thursdays lecture");
    assert.equal(result.deadline, null);
  });

  it("returns an empty title when only a date was typed", () => {
    assert.equal(parseQuickAdd("tomorrow 5pm", utc).title, "");
  });

  describe("#subject", () => {
    const subjects = [
      { id: "calc", name: "Calculus" },
      { id: "db", name: "Databases" },
      { id: "dbs", name: "DB Security" },
    ];
    const withSubjects = { ...utc, subjects };

    it("matches a subject by name prefix and removes the tag from the title", () => {
      const result = parseQuickAdd("problem set 4 #calc fri 2h", withSubjects);
      assert.equal(result.subjectId, "calc");
      assert.equal(result.subjectTag, "calc");
      assert.equal(result.title, "Problem set 4");
      assert.equal(result.estimatedMinutes, 120);
    });

    it("ignores case", () => {
      assert.equal(parseQuickAdd("#CALC revise", withSubjects).subjectId, "calc");
    });

    it("prefers an exact name over a prefix match", () => {
      const result = parseQuickAdd("lab #db", {
        ...utc,
        subjects: [
          { id: "dbs", name: "DB Security" },
          { id: "exact", name: "db" },
        ],
      });
      assert.equal(result.subjectId, "exact");
    });

    it("leaves an unknown tag in the title and reports it", () => {
      const result = parseQuickAdd("essay #history", withSubjects);
      assert.equal(result.subjectId, null);
      assert.equal(result.subjectTag, "history");
      assert.equal(result.title, "Essay #history");
    });

    it("leaves an ambiguous prefix unmatched", () => {
      // "d" fits both Databases and DB Security.
      const result = parseQuickAdd("lab #d", withSubjects);
      assert.equal(result.subjectId, null);
      assert.equal(result.subjectTag, "d");
    });

    it("has no subject when no tag is typed", () => {
      const result = parseQuickAdd("essay", withSubjects);
      assert.equal(result.subjectId, null);
      assert.equal(result.subjectTag, null);
    });
  });

  it("interprets dates and times in the user's timezone", () => {
    // 20:00 Wednesday in Los Angeles; tomorrow 09:00 local is Thursday 17:00 UTC.
    const la = { now: new Date("2026-11-12T04:00:00Z"), timezone: "America/Los_Angeles" };
    assert.equal(deadlineOf("essay tomorrow 9am", la), "2026-11-12T17:00:00.000Z");
    // A bare weekday is resolved against the local day (Wednesday), not the UTC day (Thursday).
    assert.equal(deadlineOf("essay thu", la), "2026-11-13T07:59:00.000Z");
  });
});
