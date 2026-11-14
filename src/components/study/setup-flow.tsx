"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveSubjectAction, createSubjectAction } from "@/actions/study";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import type { SubjectKind } from "@/db/schema";
import { updateSubjectSetupAction } from "@/actions/study";
import { KIND_LABEL } from "@/lib/study/labels";
import { KindPicker, SubjectSetupFields, type SetupSubject } from "./subject-setup-fields";
import type { EditableMilestone } from "./milestones-editor";
import { toSetupSubject } from "./setup-subject";
import { OutlineImport } from "./outline-import";
import { useAddedSince } from "@/components/ui/motion";

interface SetupFlowProps {
  initialSubjects: SetupSubject[];
  milestones: (EditableMilestone & { subjectId: string })[];
  hasAvailability: boolean;
  today: string;
}

const PLACEHOLDER: Record<SubjectKind, string> = {
  CLASS: "Calculus",
  PROJECT: "Portfolio site",
  SELF_LEARNING: "Japanese",
};

const STEPS = 3;

/**
 * First-use setup: what the student works on (classes, side projects,
 * self-learning), then details for each, then free hours. Everything after the
 * names is optional and saves as you go.
 */
export function SetupFlow({ initialSubjects, milestones, hasAvailability, today }: SetupFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SubjectKind>("CLASS");
  const isAdded = useAddedSince(subjects);
  // Subject whose course outline is being imported, and which ones are done.
  const [importFor, setImportFor] = useState<SetupSubject | null>(null);
  const [imported, setImported] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createSubjectAction({ name, kind });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSubjects((prev) => [...prev, toSetupSubject(result.data)]);
      setName("");
    });
  };

  const changeKind = (id: string, next: SubjectKind) => {
    const previous = subjects;
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, kind: next } : s)));
    startTransition(async () => {
      const result = await updateSubjectSetupAction({ id, kind: next });
      if (!result.success) {
        setSubjects(previous);
        setError(result.error);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await archiveSubjectAction(id, true);
      if (result.success) setSubjects((prev) => prev.filter((s) => s.id !== id));
      else setError(result.error);
    });
  };

  const finish = () => {
    router.push("/today");
  };

  return (
    <main className="mx-auto max-w-xl px-5 pt-6 sm:px-8 lg:pt-12">
      <p className="text-sm text-muted">
        Step {step} of {STEPS}
      </p>

      {step === 1 && (
        <section className="rise">
          <h1 className="mt-1 font-serif text-[32px] leading-tight">What are you working on?</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            Classes, side projects, things you learn on your own. The app learns from the time you put into each and
            suggests what to do next.
          </p>

          <p id="new-kind" className="mb-1.5 mt-6 text-[13px] text-ink-soft">
            Adding a
          </p>
          <KindPicker labelledBy="new-kind" value={kind} onChange={setKind} />
          <form onSubmit={add} className="mt-2 flex gap-2">
            <label htmlFor="subject-name" className="sr-only">
              {KIND_LABEL[kind]} name
            </label>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={PLACEHOLDER[kind]}
              maxLength={60}
              autoFocus
              enterKeyHint="done"
            />
            <Button type="submit" disabled={isPending || !name.trim()}>
              <PlusIcon className="h-4 w-4" />
              Add
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          {subjects.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {subjects.map((s) => (
                <li key={s.id} className={`py-2.5 ${isAdded(s.id) ? "enter" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium">{s.name}</span>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      aria-label={`Remove ${s.name}`}
                      className="rounded-lg p-2 text-faint hover:bg-line/60 hover:text-ink"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1">
                    <KindPicker compact value={s.kind} onChange={(next) => changeKind(s.id, next)} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button variant="primary" className="mt-8 h-12 w-full" disabled={subjects.length === 0} onClick={() => setStep(2)}>
            Next
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="rise">
          <h1 className="mt-1 font-serif text-[32px] leading-tight">A little more about each</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            All optional. Until the app has learned your habits, this decides what it suggests first.
          </p>

          <div className="mt-6 space-y-8">
            {subjects.map((s) => (
              <div key={`${s.id}-${s.kind}`}>
                <h2 className="font-serif text-xl">{s.name}</h2>
                <p className="mb-3 text-[13px] text-muted">{KIND_LABEL[s.kind]}</p>
                <SubjectSetupFields
                  subject={s}
                  today={today}
                  milestones={milestones.filter((m) => m.subjectId === s.id)}
                />
                {s.kind !== "PROJECT" && (
                  <p className="mt-3 text-sm">
                    {imported[s.id] ? (
                      <span className="text-ink-soft">{imported[s.id]} topics saved from the outline.</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setImportFor(s)}
                        className="text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        Import course outline (optional)
                      </button>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-2">
            <Button onClick={() => setStep(1)} className="h-12">
              Back
            </Button>
            <Button variant="primary" className="h-12 flex-1" onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rise">
          <h1 className="mt-1 font-serif text-[32px] leading-tight">
            {hasAvailability ? "You are set." : "When are you free?"}
          </h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            {hasAvailability
              ? "Study as usual. Rate sessions and note the topic you covered, and the suggestions get sharper."
              : "Study blocks are only planned inside the hours you are free each week. You can add them now or later."}
          </p>
          <div className="mt-8 flex flex-col gap-2">
            {!hasAvailability && (
              <Link href="/me" className={buttonClasses("primary", "md", "h-12 w-full")}>
                Set my free hours
              </Link>
            )}
            <Button variant={hasAvailability ? "primary" : "secondary"} className="h-12 w-full" onClick={finish}>
              {hasAvailability ? "Go to Today" : "Later, go to Today"}
            </Button>
          </div>
        </section>
      )}
      {importFor && (
        <OutlineImport
          subjectId={importFor.id}
          subjectName={importFor.name}
          open
          onClose={() => setImportFor(null)}
          onSaved={(count) => setImported((prev) => ({ ...prev, [importFor.id]: count }))}
        />
      )}
    </main>
  );
}
