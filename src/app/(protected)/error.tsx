"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";

export default function ProtectedError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <main className="mx-auto max-w-xl px-5 pt-10 sm:px-8 lg:px-10 lg:pt-16">
      <div className="border-l-2 border-accent pl-5">
        <h1 className="font-serif text-[30px] leading-tight">This page did not load.</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Usually it is the connection or the database waking up. Your tasks and plans are safe.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <Link href="/today" className={buttonClasses("ghost")}>
            Go to Today
          </Link>
        </div>
        {digest && <p className="mt-6 text-xs text-faint">Reference: {digest}</p>}
      </div>
    </main>
  );
}
