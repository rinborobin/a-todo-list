import { requireAuth } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative server-side session check against the database
  await requireAuth();

  return <div className="flex-1">{children}</div>;
}