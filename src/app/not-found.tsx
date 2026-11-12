import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 sm:px-8">
      <div className="border-l-2 border-line-strong pl-5">
        <h1 className="font-serif text-[30px] leading-tight">Nothing here.</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          The page or task may have been deleted, or the link is wrong.
        </p>
        <Link href="/today" className={`${buttonClasses("primary")} mt-6`}>
          Go to Today
        </Link>
      </div>
    </main>
  );
}
