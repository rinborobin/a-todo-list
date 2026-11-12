import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { buttonClasses } from "@/components/ui/button";

const steps = [
  { title: "Say when you are free", text: "Set your free hours for each day of the week, once." },
  { title: "Add what is due", text: "Type it like a message: essay due fri 5pm 2h." },
  { title: "Follow the plan", text: "Each task gets a slot before its deadline. Tick it off when done." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/today");

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-12 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-8">
      <header className="flex items-center justify-between">
        <span className="font-serif text-xl">Daily Planner</span>
        <Link href="/login" className="text-sm text-muted hover:text-ink">
          Sign in
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-xl font-serif text-[40px] leading-[1.1] sm:text-[52px]">
          Your deadlines, planned into the hours you are free.
        </h1>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
          Add what is due. The planner fits each task into your week and tells you what to do next.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/register" className={buttonClasses("primary")}>
            Create an account
          </Link>
          <Link href="/login" className={buttonClasses("ghost")}>
            Sign in
          </Link>
        </div>

        <ol className="mt-16 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="font-serif text-2xl text-faint">{index + 1}</span>
              <h2 className="mt-1 text-[15px] font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
