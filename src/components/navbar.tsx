"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { useState } from "react";

export function Navbar() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={session?.user ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-bold text-lg text-zinc-900 dark:text-zinc-100 tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-black">
            AI
          </span>
          <span>Daily Planner</span>
        </Link>

        <nav className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ) : session?.user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hidden sm:inline-block"
              >
                Dashboard
              </Link>
              <Link
                href="/tasks"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Tasks
              </Link>
              <Link
                href="/availability"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Availability
              </Link>
              <Link
                href="/planner"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Planner
              </Link>

              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[140px] sm:max-w-xs truncate">
                  {session.user.name || session.user.email}
                </span>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}