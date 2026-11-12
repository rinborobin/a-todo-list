import { LoginForm } from "@/components/auth/login-form";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm callbackUrl={safeCallbackUrl(params?.callbackUrl)} />;
}
