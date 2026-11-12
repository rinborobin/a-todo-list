import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-8">
      <Link href="/" className="font-serif text-xl">
        Daily Planner
      </Link>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
