import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { DocumentTextIcon, ClockIcon, CalendarIcon } from "@/components/ui/icons";

export default async function HomePage() {
  const user = await getCurrentUser();

  const features = [
    {
      title: "Task Management",
      description: "Track deadlines, priorities, and estimated duration with full user data isolation.",
      icon: DocumentTextIcon,
    },
    {
      title: "Smart Availability",
      description: "Define recurring work and study blocks with timezone awareness and constraint validation.",
      icon: ClockIcon,
    },
    {
      title: "AI Daily Planner",
      description: "Generate structured, conflict-free schedules and replan dynamically when events change.",
      icon: CalendarIcon,
    },
  ];

  return (
    <div className="relative isolate px-6 pt-14 lg:px-8">
      <div className="mx-auto max-w-3xl py-20 text-center sm:py-28">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Organize your tasks. <br />
          <span className="text-zinc-600 dark:text-zinc-400">Generate realistic schedules.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          AI Daily Planner helps you define your availability, prioritize tasks, and automatically
          generates realistic, conflict-free daily schedules using artificial intelligence.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-6">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold leading-6 text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <feature.icon className="mb-3 h-6 w-6 text-zinc-700 dark:text-zinc-300" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
