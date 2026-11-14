import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dueReminders, type ReminderPrefs, type ReminderTask } from "./due";

const allOn: ReminderPrefs = { morningEnabled: true, morningTime: "07:30", deadlineEnabled: true, overdueEnabled: true };
const noMorning: ReminderPrefs = { ...allOn, morningEnabled: false };

const at = (iso: string) => new Date(iso);
const task = (over: Partial<ReminderTask> = {}): ReminderTask => ({
  id: "t1",
  title: "Lab report",
  subjectName: "Biology",
  status: "TODO",
  deadline: at("2026-11-13T17:00:00Z"),
  createdAt: at("2026-11-01T09:00:00Z"),
  ...over,
});

function run(
  now: string,
  tasks: ReminderTask[],
  over: { prefs?: ReminderPrefs; timezone?: string; plannedBlocks?: number } = {}
) {
  return dueReminders({
    now: at(now),
    timezone: over.timezone ?? "UTC",
    userId: "u1",
    prefs: over.prefs ?? noMorning,
    tasks,
    plannedBlocks: over.plannedBlocks ?? 0,
  });
}

describe("before a timed deadline", () => {
  it("reminds a day before, with the real due time", () => {
    const [r, ...rest] = run("2026-11-12T17:05:00Z", [task()]);
    assert.equal(rest.length, 0);
    assert.equal(r.kind, "DUE_DAY");
    assert.equal(r.title, "Due tomorrow at 17:00");
    assert.equal(r.body, "Lab report, Biology");
    assert.equal(r.url, "/tasks/t1");
    assert.equal(r.dedupeKey, "due_day:t1:2026-11-13T17:00:00.000Z");
  });

  it("stays quiet until the day-before time", () => {
    assert.deepEqual(run("2026-11-12T16:50:00Z", [task()]), []);
  });

  it("reminds two hours before", () => {
    const [r] = run("2026-11-13T15:10:00Z", [task()]);
    assert.equal(r.kind, "DUE_SOON");
    assert.equal(r.title, "Due today at 17:00");
    assert.equal(r.dedupeKey, "due_soon:t1:2026-11-13T17:00:00.000Z");
  });

  it("gives up on a reminder that is long past its time", () => {
    assert.deepEqual(run("2026-11-13T16:45:00Z", [task()]), []);
  });

  it("leaves the subject out when the task has none", () => {
    const [r] = run("2026-11-13T15:10:00Z", [task({ subjectName: null })]);
    assert.equal(r.body, "Lab report");
  });

  it("can be switched off", () => {
    assert.deepEqual(run("2026-11-13T15:10:00Z", [task()], { prefs: { ...noMorning, deadlineEnabled: false } }), []);
  });
});

describe("before a date-only deadline", () => {
  const dateOnly = task({ deadline: at("2026-11-13T23:59:00Z") });

  it("reminds at 18:00 the day before, without a clock time", () => {
    assert.deepEqual(run("2026-11-12T17:55:00Z", [dateOnly]), []);
    const [r] = run("2026-11-12T18:05:00Z", [dateOnly]);
    assert.equal(r.kind, "DUE_DAY");
    assert.equal(r.title, "Due tomorrow");
  });

  it("reminds at 18:00 on the day instead of 21:59", () => {
    const [r] = run("2026-11-13T18:05:00Z", [dateOnly]);
    assert.equal(r.kind, "DUE_SOON");
    assert.equal(r.title, "Due today");
    assert.deepEqual(run("2026-11-13T21:20:00Z", [dateOnly]), []);
  });
});

describe("quiet hours", () => {
  it("moves a reminder that would land at night to 21:30 the evening before", () => {
    const early = task({ deadline: at("2026-11-14T08:00:00Z") });
    const [r] = run("2026-11-13T21:35:00Z", [early]);
    assert.equal(r.kind, "DUE_SOON");
    assert.equal(r.title, "Due tomorrow at 08:00");
    assert.deepEqual(run("2026-11-14T06:05:00Z", [early]), []);
  });

  it("moves a late-evening reminder to 21:30 so it is not lost", () => {
    // Due 23:50: two hours before is 21:50, and the next check could fall after 22:00.
    const late = task({ deadline: at("2026-11-13T23:50:00Z") });
    const [r] = run("2026-11-13T21:40:00Z", [late]);
    assert.equal(r.kind, "DUE_SOON");
    assert.equal(r.title, "Due today at 23:50");
  });

  it("never sends between 22:00 and 07:00 with the default settings", () => {
    const tasks = [
      task({ id: "a", deadline: at("2026-11-13T00:30:00Z") }),
      task({ id: "b", deadline: at("2026-11-13T06:00:00Z") }),
      task({ id: "c", deadline: at("2026-11-13T22:30:00Z") }),
      task({ id: "d", deadline: at("2026-11-13T23:59:00Z") }),
      task({ id: "e", deadline: at("2026-11-12T23:00:00Z") }),
    ];
    const start = at("2026-11-11T00:00:00Z").getTime();
    let sent = 0;
    for (let i = 0; i < 4 * 24 * 4; i++) {
      const now = new Date(start + i * 15 * 60_000);
      const hour = now.getUTCHours();
      const found = dueReminders({ now, timezone: "UTC", userId: "u1", prefs: allOn, tasks, plannedBlocks: 0 });
      sent += found.length;
      if (hour >= 22 || hour < 7) assert.deepEqual(found, [], `sent at ${now.toISOString()}`);
    }
    assert.ok(sent > 0);
  });
});

describe("overdue", () => {
  const due = task({ deadline: at("2026-11-12T17:00:00Z") });

  it("nudges once the deadline has passed", () => {
    const [r, ...rest] = run("2026-11-12T17:10:00Z", [due]);
    assert.equal(rest.length, 0);
    assert.equal(r.kind, "OVERDUE");
    assert.equal(r.title, "Overdue");
    assert.equal(r.body, "Lab report was due at 17:00");
    assert.equal(r.dedupeKey, "overdue:t1:2026-11-12T17:00:00.000Z");
  });

  it("does not nudge about something that passed long ago", () => {
    assert.deepEqual(run("2026-11-13T09:00:00Z", [due]), []);
  });

  it("leaves a deadline that passed overnight to the morning summary", () => {
    const overnight = task({ deadline: at("2026-11-12T23:59:00Z") });
    const found = run("2026-11-13T07:35:00Z", [overnight], { prefs: allOn });
    assert.deepEqual(
      found.map((r) => r.kind),
      ["MORNING"]
    );
    assert.match(found[0].body, /1 overdue/);
  });

  it("nudges at 07:00 instead when the morning summary is off", () => {
    const overnight = task({ deadline: at("2026-11-12T23:59:00Z") });
    assert.deepEqual(run("2026-11-13T06:50:00Z", [overnight]), []);
    const [r] = run("2026-11-13T07:05:00Z", [overnight]);
    assert.equal(r.kind, "OVERDUE");
    assert.equal(r.body, "Lab report was due yesterday");
  });

  it("can be switched off", () => {
    assert.deepEqual(run("2026-11-12T17:10:00Z", [due], { prefs: { ...noMorning, overdueEnabled: false } }), []);
  });
});

describe("morning summary", () => {
  const today = [
    task({ id: "a", title: "Lab report", deadline: at("2026-11-12T17:00:00Z") }),
    task({ id: "b", title: "Quiz", deadline: at("2026-11-12T23:59:00Z") }),
    task({ id: "c", title: "Essay", deadline: at("2026-11-11T12:00:00Z") }),
  ];

  it("lists what is due today, what is overdue and what is planned", () => {
    const found = run("2026-11-12T07:35:00Z", today, { prefs: allOn, plannedBlocks: 3 });
    const morning = found.find((r) => r.kind === "MORNING");
    assert.ok(morning);
    assert.equal(morning.title, "Today");
    assert.equal(morning.body, "2 due today: Lab report 17:00, Quiz. 1 overdue. 3 blocks planned.");
    assert.equal(morning.url, "/today");
    assert.equal(morning.dedupeKey, "morning:u1:2026-11-12");
  });

  it("shortens a long list", () => {
    const many = ["A", "B", "C", "D", "E"].map((title, i) =>
      task({ id: title, title, deadline: at(`2026-11-12T1${i}:00:00Z`) })
    );
    const [r] = run("2026-11-12T07:35:00Z", many, { prefs: allOn });
    assert.equal(r.body, "5 due today: A 10:00, B 11:00, C 12:00 and 2 more.");
  });

  it("says one block, not one blocks", () => {
    const [r] = run("2026-11-12T07:35:00Z", [], { prefs: allOn, plannedBlocks: 1 });
    assert.equal(r.body, "1 block planned.");
  });

  it("is skipped on a day with nothing on", () => {
    assert.deepEqual(run("2026-11-12T07:35:00Z", [], { prefs: allOn }), []);
  });

  it("is not sent before its time or long after it", () => {
    assert.deepEqual(run("2026-11-12T07:25:00Z", today, { prefs: allOn, plannedBlocks: 3 }), []);
    const late = run("2026-11-12T11:00:00Z", today, { prefs: allOn, plannedBlocks: 3 });
    assert.equal(late.filter((r) => r.kind === "MORNING").length, 0);
  });

  it("follows the chosen time", () => {
    const prefs = { ...allOn, morningTime: "09:00:00" };
    assert.deepEqual(run("2026-11-12T07:35:00Z", [], { prefs, plannedBlocks: 2 }), []);
    assert.equal(run("2026-11-12T09:05:00Z", [], { prefs, plannedBlocks: 2 }).length, 1);
  });

  it("ignores tasks that have been overdue for more than a week", () => {
    const stale = task({ deadline: at("2026-10-20T12:00:00Z") });
    assert.deepEqual(run("2026-11-12T07:35:00Z", [stale], { prefs: allOn }), []);
  });
});

describe("general rules", () => {
  it("never mentions finished or cancelled tasks", () => {
    const done = [task({ status: "COMPLETED" }), task({ id: "t2", status: "CANCELLED" })];
    assert.deepEqual(run("2026-11-13T15:10:00Z", done), []);
    assert.deepEqual(run("2026-11-13T17:10:00Z", done), []);
    assert.deepEqual(run("2026-11-13T07:35:00Z", done, { prefs: allOn }), []);
  });

  it("does not remind about a task added moments ago", () => {
    const fresh = task({ createdAt: at("2026-11-13T15:10:00Z") });
    assert.deepEqual(run("2026-11-13T15:30:00Z", [fresh]), []);
    assert.equal(run("2026-11-13T16:15:00Z", [fresh]).length, 1);
  });

  it("arms the reminders again when the deadline moves", () => {
    const [before] = run("2026-11-13T15:10:00Z", [task()]);
    const [after] = run("2026-11-13T16:10:00Z", [task({ deadline: at("2026-11-13T18:00:00Z") })]);
    assert.notEqual(before.dedupeKey, after.dedupeKey);
  });

  it("works in the time zone the person set", () => {
    // 23:59 on 13 Nov in Tokyo is 14:59 UTC. 18:00 the day before in Tokyo is 09:00 UTC on the 12th.
    const dateOnly = task({ deadline: at("2026-11-13T14:59:00Z") });
    assert.deepEqual(run("2026-11-12T08:50:00Z", [dateOnly], { timezone: "Asia/Tokyo" }), []);
    const [r] = run("2026-11-12T09:05:00Z", [dateOnly], { timezone: "Asia/Tokyo" });
    assert.equal(r.kind, "DUE_DAY");
    assert.equal(r.title, "Due tomorrow");

    // 07:30 on 13 Nov in Tokyo is 22:30 UTC on the 12th.
    const [m] = run("2026-11-12T22:35:00Z", [], { timezone: "Asia/Tokyo", prefs: allOn, plannedBlocks: 2 });
    assert.equal(m.dedupeKey, "morning:u1:2026-11-13");
  });
});
