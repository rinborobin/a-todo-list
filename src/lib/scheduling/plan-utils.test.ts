import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Availability, Task } from "@/db/schema";
import { scheduleTasks } from "./engine";
import { addDaysToDateKey, toLocalDateKey, toLocalTimeString } from "./timezone";
import { buildBusyWindows, groupScheduledItemsByLocalDate } from "./plan-utils";

function makeTask(id: string, estimatedMinutes = 60): Task {
  const created = new Date("2026-01-01T00:00:00Z");
  return {
    id,
    userId: "user-1",
    subjectId: null,
    title: id,
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    estimatedMinutes,
    deadline: null,
    createdAt: created,
    updatedAt: created,
  };
}

function makeAvailability(dayOfWeek: Availability["dayOfWeek"], startTime: string, endTime: string): Availability {
  return {
    id: `${dayOfWeek}-${startTime}`,
    userId: "user-1",
    dayOfWeek,
    startTime,
    endTime,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("toLocalDateKey", () => {
  it("uses the local calendar date for timezones behind UTC", () => {
    // 2026-11-14T02:00Z is 18:00 on 2026-11-13 in Los Angeles.
    assert.equal(toLocalDateKey(new Date("2026-11-14T02:00:00Z"), "America/Los_Angeles"), "2026-11-13");
  });

  it("uses the local calendar date for timezones ahead of UTC", () => {
    // 2026-11-13T22:00Z is 07:00 on 2026-11-14 in Tokyo.
    assert.equal(toLocalDateKey(new Date("2026-11-13T22:00:00Z"), "Asia/Tokyo"), "2026-11-14");
  });

  it("matches the UTC date for UTC", () => {
    assert.equal(toLocalDateKey(new Date("2026-01-02T23:59:00Z"), "UTC"), "2026-01-02");
  });
});

describe("toLocalTimeString", () => {
  it("formats the local wall-clock time as HH:mm", () => {
    assert.equal(toLocalTimeString(new Date("2026-11-12T04:05:00Z"), "America/Los_Angeles"), "20:05");
    assert.equal(toLocalTimeString(new Date("2026-11-12T00:00:00Z"), "UTC"), "00:00");
  });
});

describe("addDaysToDateKey", () => {
  it("adds days across month and year boundaries", () => {
    assert.equal(addDaysToDateKey("2026-11-28", 6), "2026-12-04");
    assert.equal(addDaysToDateKey("2026-12-30", 3), "2027-01-02");
    assert.equal(addDaysToDateKey("2026-11-11", 0), "2026-11-11");
  });
});

describe("groupScheduledItemsByLocalDate", () => {
  it("files an evening item under the local date, not the UTC date", () => {
    // 18:00-19:00 on 2026-11-13 in Los Angeles is 02:00-03:00 on 2026-11-14 UTC.
    const groups = groupScheduledItemsByLocalDate(
      [
        { taskId: "a", startTime: new Date("2026-11-13T17:00:00Z"), endTime: new Date("2026-11-13T18:00:00Z") },
        { taskId: "b", startTime: new Date("2026-11-14T02:00:00Z"), endTime: new Date("2026-11-14T03:00:00Z") },
      ],
      "America/Los_Angeles"
    );

    assert.deepEqual([...groups.keys()], ["2026-11-13"]);
    assert.deepEqual(groups.get("2026-11-13")?.map((item) => item.taskId), ["a", "b"]);
  });
});

describe("buildBusyWindows", () => {
  it("ignores items still marked SCHEDULED because regeneration replaces them", () => {
    const windows = buildBusyWindows([
      { status: "SCHEDULED", startTime: new Date("2026-09-14T09:00:00Z"), endTime: new Date("2026-09-14T10:00:00Z") },
      { status: "COMPLETED", startTime: new Date("2026-09-14T11:00:00Z"), endTime: new Date("2026-09-14T12:00:00Z") },
      { status: "SKIPPED", startTime: new Date("2026-09-14T13:00:00Z"), endTime: new Date("2026-09-14T14:00:00Z") },
    ]);

    assert.deepEqual(
      windows.map((w) => w.start.toISOString()),
      ["2026-09-14T11:00:00.000Z", "2026-09-14T13:00:00.000Z"]
    );
  });

  it("lets a regenerated plan reuse the slots of the plan it replaces", () => {
    const input = {
      tasks: [makeTask("c")],
      availability: [makeAvailability("FRIDAY", "09:00:00", "23:00:00")],
      timezone: "America/Los_Angeles",
      startDate: "2026-11-13",
      endDate: "2026-11-13",
      now: new Date("2026-11-01T00:00:00Z"),
    };

    const first = scheduleTasks({ ...input, existingItems: [] });
    const previousItems = first.scheduled.map((item) => ({
      status: "SCHEDULED" as const,
      startTime: item.startTime,
      endTime: item.endTime,
    }));
    const regenerated = scheduleTasks({ ...input, existingItems: buildBusyWindows(previousItems) });

    assert.equal(
      regenerated.scheduled[0]?.startTime.toISOString(),
      first.scheduled[0]?.startTime.toISOString()
    );
  });

  it("keeps completed items blocking their time on regeneration", () => {
    const input = {
      tasks: [makeTask("c")],
      availability: [makeAvailability("MONDAY", "09:00:00", "17:00:00")],
      timezone: "UTC",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      now: new Date("2026-09-14T07:00:00Z"),
    };

    const regenerated = scheduleTasks({
      ...input,
      existingItems: buildBusyWindows([
        { status: "COMPLETED", startTime: new Date("2026-09-14T09:00:00Z"), endTime: new Date("2026-09-14T10:00:00Z") },
      ]),
    });

    assert.equal(regenerated.scheduled[0]?.startTime.toISOString(), "2026-09-14T10:00:00.000Z");
  });
});
