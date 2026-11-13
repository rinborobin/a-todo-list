import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentMilestone, milestoneProgress, nextProjectTask, resourceProgress } from "./progress";

describe("resourceProgress", () => {
  it("names the next unit with the total", () => {
    const p = resourceProgress({ resourceName: "Genki I", resourceUnit: "lesson", resourceTotal: 40, resourceDone: 18 });
    assert.equal(p?.doneLabel, "Lesson 18 of 40");
    assert.equal(p?.nextLabel, "Lesson 19 of 40");
    assert.equal(p?.nextShort, "Lesson 19");
    assert.equal(p?.finished, false);
  });

  it("works without a total", () => {
    const p = resourceProgress({ resourceName: "Rust book", resourceUnit: "chapter", resourceTotal: null, resourceDone: 3 });
    assert.equal(p?.nextLabel, "Chapter 4");
    assert.equal(p?.doneLabel, "Chapter 3");
  });

  it("falls back to 'part' when no unit is given", () => {
    const p = resourceProgress({ resourceName: "Course", resourceUnit: null, resourceTotal: 10, resourceDone: 0 });
    assert.equal(p?.nextLabel, "Part 1 of 10");
    assert.equal(p?.doneLabel, "Not started");
  });

  it("has no next unit once finished", () => {
    const p = resourceProgress({ resourceName: "Genki I", resourceUnit: "lesson", resourceTotal: 12, resourceDone: 12 });
    assert.equal(p?.finished, true);
    assert.equal(p?.nextLabel, null);
    assert.equal(p?.doneLabel, "Finished, 12 lessons");
  });

  it("is null when nothing is tracked", () => {
    assert.equal(resourceProgress({ resourceName: null, resourceUnit: null, resourceTotal: null, resourceDone: 0 }), null);
  });
});

const milestones = [
  { id: "launch", subjectId: "site", name: "Launch", targetDate: "2026-12-20", completedAt: null, sortOrder: 2 },
  { id: "design", subjectId: "site", name: "Design", targetDate: "2026-11-01", completedAt: new Date("2026-11-02"), sortOrder: 0 },
  { id: "mvp", subjectId: "site", name: "MVP", targetDate: "2026-11-21", completedAt: null, sortOrder: 1 },
  { id: "other", subjectId: "app", name: "Beta", targetDate: null, completedAt: null, sortOrder: 0 },
];

describe("currentMilestone", () => {
  it("is the first open milestone in order", () => {
    assert.equal(currentMilestone("site", milestones)?.id, "mvp");
    assert.equal(currentMilestone("app", milestones)?.id, "other");
    assert.equal(currentMilestone("none", milestones), null);
  });
});

describe("milestoneProgress", () => {
  it("counts finished tasks out of the milestone's tasks, ignoring cancelled", () => {
    const p = milestoneProgress("mvp", [
      { milestoneId: "mvp", status: "COMPLETED" },
      { milestoneId: "mvp", status: "TODO" },
      { milestoneId: "mvp", status: "IN_PROGRESS" },
      { milestoneId: "mvp", status: "CANCELLED" },
      { milestoneId: "launch", status: "COMPLETED" },
    ]);
    assert.deepEqual(p, { done: 1, total: 3 });
  });
});

describe("nextProjectTask", () => {
  const t = (id: string, milestoneId: string | null, deadline: string | null = null) => ({
    id,
    title: id,
    subjectId: "site",
    milestoneId,
    deadline: deadline ? new Date(deadline) : null,
    estimatedMinutes: 60,
  });

  it("takes tasks of the current milestone before loose tasks with closer deadlines", () => {
    const next = nextProjectTask("site", milestones, [
      t("loose", null, "2026-11-13T10:00:00Z"),
      t("launch-copy", "launch", "2026-11-14T10:00:00Z"),
      t("mvp-login", "mvp", "2026-11-19T10:00:00Z"),
      t("mvp-db", "mvp", "2026-11-16T10:00:00Z"),
    ]);
    assert.equal(next?.task.id, "mvp-db");
    assert.equal(next?.milestone?.name, "MVP");
  });

  it("falls back to later milestones, then loose tasks", () => {
    assert.equal(nextProjectTask("site", milestones, [t("loose", null), t("launch-copy", "launch")])?.task.id, "launch-copy");
    assert.equal(nextProjectTask("site", milestones, [t("loose", null)])?.milestone, null);
  });

  it("skips tasks made by Add to my plan, and other subjects' tasks", () => {
    const next = nextProjectTask("site", milestones, [
      { ...t("coach", null), title: "Study: Site" },
      { ...t("elsewhere", "mvp"), subjectId: "app" },
    ]);
    assert.equal(next, null);
  });
});
