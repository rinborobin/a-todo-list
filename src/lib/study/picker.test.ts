import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toPickerSubjects } from "./picker";

const now = new Date("2026-11-14T10:00:00Z");

describe("toPickerSubjects", () => {
  const picked = toPickerSubjects({
    subjects: [
      { id: "site", name: "Portfolio", archivedAt: null, kind: "PROJECT" },
      { id: "jp", name: "Japanese", archivedAt: null, kind: "SELF_LEARNING" },
      { id: "web", name: "Web Dev", archivedAt: null, kind: "CLASS" },
      { id: "old", name: "Old class", archivedAt: new Date(), kind: "CLASS" },
    ],
    topics: [
      { id: "flex", name: "Flexbox", subjectId: "web", position: 0 },
      { id: "grid", name: "CSS Grid", subjectId: "web", position: 1 },
      { id: "anim", name: "Animations", subjectId: "web", position: 2 },
      { id: "gone", name: "Dropped", subjectId: "web", position: 3, archivedAt: new Date() },
    ],
    milestones: [{ id: "mvp", subjectId: "site", name: "MVP", targetDate: null, completedAt: null, sortOrder: 0 }],
    openTasks: [
      { id: "blog", title: "Write blog post", subjectId: "site", deadline: null, estimatedMinutes: 30 },
      { id: "login", title: "Build login", subjectId: "site", milestoneId: "mvp", deadline: null, estimatedMinutes: 60 },
      { id: "coach", title: "Study: Portfolio", subjectId: "site", deadline: null, estimatedMinutes: 60 },
    ],
    sessions: [{ subjectId: "web", topicId: "flex", startedAt: new Date(now.getTime() - 86_400_000), minutes: 30, rating: "GOT_IT" }],
    today: "2026-11-14",
  });

  it("offers only active subjects: classes, then self-learning, then projects", () => {
    assert.deepEqual(picked.map((s) => s.id), ["web", "jp", "site"]);
  });

  it("lists topics with the next one to learn first and studied ones last", () => {
    const web = picked[0];
    assert.deepEqual(web.topics.map((t) => [t.id, t.next, t.studied]), [
      ["grid", true, false],
      ["anim", false, false],
      ["flex", false, true],
    ]);
  });

  it("lists a project's tasks with its next task first, without Add to my plan blocks", () => {
    const site = picked[2];
    assert.deepEqual(site.tasks.map((t) => [t.id, t.next]), [
      ["login", true],
      ["blog", false],
    ]);
    assert.equal(site.topics.length, 0);
  });
});
