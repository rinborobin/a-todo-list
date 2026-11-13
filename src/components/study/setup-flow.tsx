"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveSubjectAction, createSubjectAction } from "@/actions/study";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { SubjectSetupFields, type SetupSubject } from "./subject-setup-fields";

interface SetupFlowProps {
  initialSubjects: SetupSubject[];
  hasAvailability: boolean;
  today: string;
}

const STEPS = 3;

/**
 * First-use setup: subjects, then how the student feels about each, then free
 * hours. Everything after the subject names is optional and saves as you go.
 */
export function SetupFlow({ initialSubjects, hasAvailability, today }: SetupFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createSubjectAction({ name });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const s = result.data;
      setSubjects((prev) => [
        ...prev,
        { id: s.id, name: s.name, confidence: s.confidence, examDate: s.examDate, weeklyGoalMinutes: s.weeklyGoalMinutes },
      ]);
      setName("");
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
          <h1 className="mt-1 font-serif text-[32px] leading-tight">What are you studying?</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            Add your subjects. The app learns from what you study in each one and suggests what to do next.
          </p>

          <form onSubmit={add} className="mt-6 flex gap-2">
            <label htmlFor="subject-name" className="sr-only">
              Subject name
            </label>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={subjects.length === 0 ? "Calculus" : "Add another"}
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
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <span className="text-[15px] font-medium">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={`Remove ${s.name}`}
                    className="rounded-lg p-2 text-faint hover:bg-line/60 hover:text-ink"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
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
          <h1 className="mt-1 font-serif text-[32px] leading-tight">How do they feel?</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            All optional. Until the app has learned your habits, this decides what it suggests first.
          </p>

          <div className="mt-6 space-y-8">
            {subjects.map((s) => (
              <div key={s.id}>
                <h2 className="mb-3 font-serif text-xl">{s.name}</h2>
                <SubjectSetupFields subject={s} today={today} />
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
    </main>
  );
}
