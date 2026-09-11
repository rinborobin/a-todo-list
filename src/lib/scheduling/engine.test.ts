import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Availability, Task } from "@/db/schema";
import { scheduleTasks, toDateKey } from "./engine";
import type { ScheduleInput, TimeWindow } from "./types";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  const now = new Date();
  return {
    id: overrides.id,
    userId: "user-1",
    title: overrides.title ?? "Task",
    description: overrides.description ?? null,
    priority: overrides.priority ?? "MEDIUM",
    status: overrides.status ?? "TODO",
    estimatedMinutes:
      overrides.estimatedMinutes === undefined ? 60 : overrides.estimatedMinutes,
    deadline: overrides.deadline ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeAvailability(overrides: Partial<Availability> & { id: string }): Availability {
  return {
    id: overrides.id,
    userId: "user-1",
    dayOfWeek: overrides.dayOfWeek ?? "MONDAY",
    startTime: overrides.startTime ?? "09:00:00",
    endTime: overrides.endTime ?? "17:00:00",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function baseInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    tasks: [],
    availability: [],
    existingItems: [],
    timezone: "UTC",
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    now: new Date("2026-09-14T07:00:00Z"),
    ...overrides,
  };
}

describe("scheduleTasks", () => {
  it("schedules a single task into the first available window", () => {
    const task = makeTask({ id: "t1", estimatedMinutes: 60, priority: "MEDIUM" });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(baseInput({ tasks: [task], availability }));

    assert.equal(result.scheduled.length, 1);
    assert.equal(result.unscheduled.length, 0);
    assert.equal(result.scheduled[0]?.taskId, "t1");
    assert.equal(result.scheduled[0]?.startTime.toISOString(), "2026-09-14T09:00:00.000Z");
    assert.equal(result.scheduled[0]?.endTime.toISOString(), "2026-09-14T10:00:00.000Z");
  });

  it("orders tasks by priority then deadline then duration", () => {
    const tasks = [
      makeTask({ id: "low", priority: "LOW", estimatedMinutes: 30 }),
      makeTask({ id: "urgent", priority: "URGENT", estimatedMinutes: 30 }),
      makeTask({ id: "high-soon", priority: "HIGH", estimatedMinutes: 30, deadline: new Date("2026-09-14T12:00:00Z") }),
      makeTask({ id: "high-later", priority: "HIGH", estimatedMinutes: 30, deadline: new Date("2026-09-14T14:00:00Z") }),
    ];
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "12:00:00" })];

    const result = scheduleTasks(baseInput({ tasks, availability }));

    const ids = result.scheduled.map((item) => item.taskId);
    assert.deepEqual(ids, ["urgent", "high-soon", "high-later", "low"]);
  });

  it("excludes completed and cancelled tasks", () => {
    const tasks = [
      makeTask({ id: "done", status: "COMPLETED" }),
      makeTask({ id: "cancelled", status: "CANCELLED" }),
      makeTask({ id: "todo", status: "TODO" }),
    ];
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(baseInput({ tasks, availability }));

    assert.equal(result.scheduled.length, 1);
    assert.equal(result.scheduled[0]?.taskId, "todo");
    assert.equal(result.unscheduled.length, 2);
  });

  it("reports tasks without estimated duration as unscheduled", () => {
    const task = makeTask({ id: "no-duration", estimatedMinutes: null });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(baseInput({ tasks: [task], availability }));

    assert.equal(result.scheduled.length, 0);
    assert.equal(result.unscheduled.length, 1);
    assert.ok(result.unscheduled[0]?.reason.includes("no estimated duration"));
  });

  it("respects existing schedule items by avoiding overlap", () => {
    const task = makeTask({ id: "t1", estimatedMinutes: 120 });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "13:00:00" })];
    const existingItems: TimeWindow[] = [
      { start: new Date("2026-09-14T09:00:00Z"), end: new Date("2026-09-14T10:00:00Z") },
    ];

    const result = scheduleTasks(baseInput({ tasks: [task], availability, existingItems }));

    assert.equal(result.scheduled.length, 1);
    assert.equal(result.scheduled[0]?.startTime.toISOString(), "2026-09-14T10:00:00.000Z");
    assert.equal(result.scheduled[0]?.endTime.toISOString(), "2026-09-14T12:00:00.000Z");
  });

  it("reports tasks too long for any window", () => {
    const task = makeTask({ id: "long", estimatedMinutes: 120 });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "10:00:00" })];

    const result = scheduleTasks(baseInput({ tasks: [task], availability }));

    assert.equal(result.scheduled.length, 0);
    assert.equal(result.unscheduled.length, 1);
    assert.ok(result.unscheduled[0]?.reason.includes("longer than any available"));
  });

  it("does not schedule tasks whose deadline has already passed", () => {
    const task = makeTask({ id: "t1", estimatedMinutes: 60, deadline: new Date("2026-09-14T08:30:00Z") });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(
      baseInput({
        tasks: [task],
        availability,
        now: new Date("2026-09-14T09:00:00Z"),
      })
    );

    assert.equal(result.scheduled.length, 0);
    assert.equal(result.unscheduled.length, 1);
    assert.ok(result.unscheduled[0]?.reason.includes("deadline"));
  });

  it("clips today's windows to the current time", () => {
    const task = makeTask({ id: "t1", estimatedMinutes: 60 });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(
      baseInput({
        tasks: [task],
        availability,
        now: new Date("2026-09-14T10:30:00Z"),
      })
    );

    assert.equal(result.scheduled[0]?.startTime.toISOString(), "2026-09-14T10:30:00.000Z");
    assert.equal(result.scheduled[0]?.endTime.toISOString(), "2026-09-14T11:30:00.000Z");
  });

  it("is deterministic for identical inputs", () => {
    const tasks = [
      makeTask({ id: "a", priority: "HIGH", estimatedMinutes: 30 }),
      makeTask({ id: "b", priority: "MEDIUM", estimatedMinutes: 30 }),
      makeTask({ id: "c", priority: "URGENT", estimatedMinutes: 30 }),
    ];
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];
    const input = baseInput({ tasks, availability });

    const first = scheduleTasks(input);
    const second = scheduleTasks(input);

    assert.deepEqual(
      first.scheduled.map((i) => i.taskId),
      second.scheduled.map((i) => i.taskId)
    );
    assert.deepEqual(
      first.unscheduled.map((u) => u.task.id),
      second.unscheduled.map((u) => u.task.id)
    );
  });

  it("handles timezone conversion for non-UTC timezones", () => {
    const task = makeTask({ id: "t1", estimatedMinutes: 60 });
    const availability = [makeAvailability({ id: "a1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "17:00:00" })];

    const result = scheduleTasks(
      baseInput({
        tasks: [task],
        availability,
        timezone: "America/New_York",
      })
    );

    // 09:00 New York on 2026-09-14 is UTC 13:00 (EDT, UTC-4)
    assert.equal(result.scheduled[0]?.startTime.toISOString(), "2026-09-14T13:00:00.000Z");
    assert.equal(result.scheduled[0]?.endTime.toISOString(), "2026-09-14T14:00:00.000Z");
  });
});

describe("toDateKey", () => {
  it("formats UTC dates as YYYY-MM-DD", () => {
    assert.equal(toDateKey(new Date("2026-09-14T00:00:00Z")), "2026-09-14");
    assert.equal(toDateKey(new Date("2026-01-02T00:00:00Z")), "2026-01-02");
  });
});
