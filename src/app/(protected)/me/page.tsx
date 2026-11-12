import { requireAuth } from "@/lib/session";
import { getUserAvailabilityQuery, getUserTimezoneQuery } from "@/actions/availability";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import { SignOutButton } from "@/components/shell/sign-out-button";

export const metadata = {
  title: "Me",
};

export default async function MePage() {
  const session = await requireAuth("/me");
  const [blocks, timezone] = await Promise.all([getUserAvailabilityQuery(), getUserTimezoneQuery()]);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10">
      <header>
        <p className="text-sm text-muted">{session.user.email}</p>
        <h1 className="font-serif text-[34px] leading-tight lg:text-[40px]">{session.user.name || "Me"}</h1>
      </header>

      <div className="mt-8">
        <AvailabilityManager initialBlocks={blocks} initialTimezone={timezone} />
      </div>

      <section aria-labelledby="account-heading" className="mt-10">
        <h2 id="account-heading" className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          Account
        </h2>
        <SignOutButton />
      </section>
    </main>
  );
}
