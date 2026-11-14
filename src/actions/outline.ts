"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, sql as sqlTag } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { studySession, subject, topic, user, type StudyRating, type Topic } from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { safeErrorMessage } from "@/lib/error";
import { takeAiQuota } from "@/lib/ai-quota";
import { readOutlineWithAi, suggestNextTopicWithAi } from "@/lib/ai/topics";
import type { OutlineTopic } from "@/lib/ai/outline-schemas";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { topicNameSchema } from "@/lib/validations/study";
import { newTopicsInOrder } from "@/lib/study/next";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 20_000;

/** The first bytes of each accepted file type, so a renamed file is not sent on. */
const SIGNATURES: { mediaType: string; test: (b: Uint8Array) => boolean }[] = [
  { mediaType: "application/pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mediaType: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mediaType: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mediaType: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

function revalidateTopicViews() {
  for (const path of ["/today", "/progress", "/me", "/setup", "/focus"]) revalidatePath(path);
}

/** A class or self-learning subject the user owns; projects have milestones instead. */
async function ownLearningSubject(userId: string, subjectId: unknown) {
  if (typeof subjectId !== "string" || !subjectId) return null;
  const found = await db.query.subject.findFirst({
    where: and(eq(subject.id, subjectId), eq(subject.userId, userId)),
    columns: { id: true, name: true, kind: true },
  });
  return found && found.kind !== "PROJECT" ? found : null;
}

async function userToday(userId: string) {
  const record = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { timezone: true } });
  return toLocalDateKey(new Date(), record?.timezone ?? "UTC");
}

/**
 * Reads the topics of a course outline (photo, PDF or pasted text) with AI.
 * Returns a draft for the student to check; nothing is saved here.
 */
export async function readOutlineAction(formData: FormData): Promise<ActionResult<{ topics: OutlineTopic[] }>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const found = await ownLearningSubject(userId, formData.get("subjectId"));
    if (!found) return { success: false, error: "Subject not found" };

    const text = formData.get("text");
    const file = formData.get("file");
    let source: Parameters<typeof readOutlineWithAi>[0];

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return { success: false, error: "That file is over 4 MB. Try a smaller photo or PDF." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const match = SIGNATURES.find((s) => s.test(bytes));
      if (!match) return { success: false, error: "Use a photo (JPEG, PNG, WebP) or a PDF." };
      source = { kind: "file", data: bytes, mediaType: match.mediaType };
    } else if (typeof text === "string" && text.trim()) {
      if (text.length > MAX_TEXT_CHARS) return { success: false, error: "That text is too long. Paste the topic part only." };
      source = { kind: "text", text: text.trim() };
    } else {
      return { success: false, error: "Add a photo, a PDF or the outline text." };
    }

    if (!(await takeAiQuota(userId, "outline"))) {
      return { success: false, error: "You have read a lot of outlines this hour. Try again later." };
    }

    const topics = await readOutlineWithAi(source, { subjectName: found.name, today: await userToday(userId) });
    if (topics === null) return { success: false, error: "Could not read that outline. Try a clearer photo or paste the text." };
    if (topics.length === 0) return { success: false, error: "No topics found in that outline." };
    return { success: true, data: { topics } };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not read the outline") };
  }
}

/** Latest rating per studied topic, for the topic lists on Me. */
export async function getTopicProgressQuery(): Promise<Record<string, { rating: StudyRating | null }>> {
  const session = await requireAuth();
  const rows = await db.query.studySession.findMany({
    where: and(eq(studySession.userId, session.user.id), isNotNull(studySession.topicId), isNotNull(studySession.endedAt)),
    columns: { topicId: true, startedAt: true, rating: true },
  });
  const latest = new Map<string, { at: number; rating: (typeof rows)[number]["rating"] }>();
  for (const r of rows) {
    const at = r.startedAt.getTime();
    if (!latest.has(r.topicId!) || at > latest.get(r.topicId!)!.at) latest.set(r.topicId!, { at, rating: r.rating });
  }
  return Object.fromEntries([...latest].map(([id, v]) => [id, { rating: v.rating }]));
}

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const saveOutlineSchema = z.object({
  subjectId: z.string().min(1),
  topics: z
    .array(
      z.object({
        name: topicNameSchema,
        week: z.number().int().min(1).max(60).nullable().optional(),
        date: dateKey.nullable().optional(),
      })
    )
    .min(1, "Keep at least one topic")
    .max(60, "At most 60 topics"),
});

/**
 * Saves the checked outline as the subject's topic list, in order. Topics the
 * subject already has (same name, any case) keep their history and get the new
 * position and class date; the rest are added. Topics not in the outline move
 * after it, in their old order.
 */
export async function saveOutlineAction(input: unknown): Promise<ActionResult<{ saved: number }>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = saveOutlineSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the topics" };
    const found = await ownLearningSubject(userId, parsed.data.subjectId);
    if (!found) return { success: false, error: "Subject not found" };

    // Repeated names in the edited list keep their first place.
    const seen = new Set<string>();
    const list = parsed.data.topics.filter((t) => {
      const key = t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await db.transaction(async (tx) => {
      const existing = await tx.query.topic.findMany({
        where: and(eq(topic.subjectId, found.id), eq(topic.userId, userId)),
      });
      const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
      const now = new Date();

      for (const [index, item] of list.entries()) {
        const match = byName.get(item.name.toLowerCase());
        if (match) {
          await tx
            .update(topic)
            .set({ position: index, plannedOn: item.date ?? match.plannedOn, archivedAt: null, updatedAt: now })
            .where(and(eq(topic.id, match.id), eq(topic.userId, userId)));
        } else {
          await tx.insert(topic).values({
            userId,
            subjectId: found.id,
            name: item.name,
            position: index,
            origin: "OUTLINE",
            plannedOn: item.date ?? null,
          });
        }
      }

      const rest = existing
        .filter((t) => !seen.has(t.name.toLowerCase()) && t.position !== null)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const [offset, t] of rest.entries()) {
        await tx
          .update(topic)
          .set({ position: list.length + offset })
          .where(and(eq(topic.id, t.id), eq(topic.userId, userId)));
      }
    });

    revalidateTopicViews();
    return { success: true, data: { saved: list.length } };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not save the topics") };
  }
}

const createTopicSchema = z.object({ subjectId: z.string().min(1), name: topicNameSchema });

/** Adds a topic by hand at the end of the subject's list. */
export async function createTopicAction(input: unknown): Promise<ActionResult<Topic>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = createTopicSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Name the topic" };
    const found = await ownLearningSubject(userId, parsed.data.subjectId);
    if (!found) return { success: false, error: "Subject not found" };

    const existing = await db.query.topic.findFirst({
      where: and(eq(topic.subjectId, found.id), eq(topic.userId, userId), eq(sqlLower(topic.name), parsed.data.name.toLowerCase())),
    });
    if (existing && !existing.archivedAt) return { success: false, error: "That topic is already on the list" };

    const position = await nextPosition(userId, found.id);
    const [saved] = existing
      ? await db
          .update(topic)
          .set({ archivedAt: null, position, updatedAt: new Date() })
          .where(and(eq(topic.id, existing.id), eq(topic.userId, userId)))
          .returning()
      : await db
          .insert(topic)
          .values({ userId, subjectId: found.id, name: parsed.data.name, position, origin: "OUTLINE" })
          .returning();
    revalidateTopicViews();
    return { success: true, data: saved };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not add the topic") };
  }
}

function sqlLower(column: typeof topic.name) {
  return sqlTag`lower(${column})`;
}

async function nextPosition(userId: string, subjectId: string): Promise<number> {
  const [row] = await db
    .select({ max: sqlTag<number | null>`max(${topic.position})` })
    .from(topic)
    .where(and(eq(topic.subjectId, subjectId), eq(topic.userId, userId)));
  return (row?.max ?? -1) + 1;
}

const suggestSchema = z.object({ subjectId: z.string().min(1), afterTopicId: z.string().min(1).nullable().optional() });

export interface NextTopicSuggestion {
  topic: Pick<Topic, "id" | "name" | "origin" | "reason" | "plannedOn">;
  /** True when the AI suggested it just now (rather than the outline already listing it). */
  fresh: boolean;
}

/**
 * What to learn next in a subject. The outline (or an earlier suggestion) comes
 * first and needs no AI. Only when no unstudied topic is left does the AI
 * suggest one, which is validated and added to the list, so the same
 * suggestion is shown again next time instead of asking again.
 */
export async function suggestNextTopicAction(input: unknown): Promise<ActionResult<NextTopicSuggestion | null>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = suggestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the details" };
    const found = await ownLearningSubject(userId, parsed.data.subjectId);
    if (!found) return { success: false, error: "Subject not found" };

    const [topics, sessions] = await Promise.all([
      db.query.topic.findMany({ where: and(eq(topic.subjectId, found.id), eq(topic.userId, userId)) }),
      db.query.studySession.findMany({
        where: and(eq(studySession.userId, userId), eq(studySession.subjectId, found.id), isNotNull(studySession.topicId)),
        columns: { topicId: true, startedAt: true, rating: true },
      }),
    ]);
    const today = await userToday(userId);
    const studied = new Set(sessions.map((s) => s.topicId));
    const listed = newTopicsInOrder(topics, studied, today)[0];
    if (listed) {
      return {
        success: true,
        data: {
          topic: { id: listed.id, name: listed.name, origin: listed.origin, reason: listed.reason, plannedOn: listed.plannedOn },
          fresh: false,
        },
      };
    }

    if (!(await takeAiQuota(userId, "next-topic"))) return { success: true, data: null };

    // Studied topics oldest first, with how the latest session felt.
    const firstSeen = new Map<string, number>();
    const latest = new Map<string, { at: number; rating: (typeof sessions)[number]["rating"] }>();
    for (const s of sessions) {
      const id = s.topicId!;
      const at = s.startedAt.getTime();
      firstSeen.set(id, Math.min(firstSeen.get(id) ?? Infinity, at));
      if (!latest.has(id) || at > latest.get(id)!.at) latest.set(id, { at, rating: s.rating });
    }
    const active = topics.filter((t) => !t.archivedAt);
    const studiedTopics = active
      .filter((t) => firstSeen.has(t.id))
      .sort((a, b) => firstSeen.get(a.id)! - firstSeen.get(b.id)!)
      .slice(-30);
    const after = parsed.data.afterTopicId ? topics.find((t) => t.id === parsed.data.afterTopicId) : undefined;

    const suggestion = await suggestNextTopicWithAi({
      subjectName: found.name,
      kind: found.kind === "SELF_LEARNING" ? "SELF_LEARNING" : "CLASS",
      studied: studiedTopics.map((t) => ({ name: t.name, lastRating: latest.get(t.id)?.rating ?? null })),
      upcoming: [],
      justFinished: after?.name ?? studiedTopics.at(-1)?.name ?? null,
      dismissed: topics.filter((t) => t.archivedAt).map((t) => t.name).slice(0, 30),
    });
    if (!suggestion) return { success: true, data: null };

    const [created] = await db
      .insert(topic)
      .values({
        userId,
        subjectId: found.id,
        name: suggestion.name,
        position: await nextPosition(userId, found.id),
        origin: "AI",
        reason: suggestion.reason,
      })
      .onConflictDoNothing()
      .returning();
    // Another request added the same name first: show that one.
    const row =
      created ??
      (await db.query.topic.findFirst({
        where: and(eq(topic.subjectId, found.id), eq(topic.userId, userId), eq(sqlLower(topic.name), suggestion.name.toLowerCase())),
      }));
    if (!row || row.archivedAt) return { success: true, data: null };

    revalidateTopicViews();
    return {
      success: true,
      data: { topic: { id: row.id, name: row.name, origin: row.origin, reason: row.reason, plannedOn: row.plannedOn }, fresh: true },
    };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not suggest a topic") };
  }
}
