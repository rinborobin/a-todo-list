import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="relative isolate px-6 pt-14 lg:px-8">
      <div className="mx-auto max-w-3xl py-20 sm:py-28 text-center">
        <div className="hidden sm:mb-8 sm:flex sm:justify-center">
          <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-900/10 dark:ring-white/10 hover:ring-zinc-900/20">
            Powered by Neon PostgreSQL & Google Gemini AI.
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          Organize your tasks. <br />
          <span className="text-zinc-600 dark:text-zinc-400">Generate realistic schedules.</span>
        </h1>

        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          AI Daily Planner helps you define your availability, prioritize tasks, and automatically generates realistic, conflict-free daily schedules using artificial intelligence.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-6">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Sign In <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-6 shadow-sm">
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Task Management</h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Track deadlines, priorities, and estimated duration with full user data isolation.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-6 shadow-sm">
            <div className="text-2xl mb-2">⏰</div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Smart Availability</h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Define recurring work and study blocks with timezone awareness and constraint validation.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-6 shadow-sm">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI Daily Planner</h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Generate structured, conflict-free schedules and replan dynamically when events change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}