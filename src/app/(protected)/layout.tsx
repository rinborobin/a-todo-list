import { requireAuth } from "@/lib/session";
import { AppNav } from "@/components/shell/app-nav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative server-side session check against the database
  const session = await requireAuth();

  return (
    <>
      <AppNav userName={session.user.name || session.user.email} />
      <div className="pb-nav pt-[env(safe-area-inset-top)] lg:pl-56">{children}</div>
    </>
  );
}
