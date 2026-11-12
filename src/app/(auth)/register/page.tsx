import { RegisterForm } from "@/components/auth/register-form";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export const metadata = {
  title: "Create an account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return <RegisterForm callbackUrl={safeCallbackUrl(params?.callbackUrl)} />;
}
