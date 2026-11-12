import { LoginForm } from "@/components/auth/login-form";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { SIGNUP_CLOSED } from "@/lib/allowed-emails";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = params?.error
    ? params.error === SIGNUP_CLOSED
      ? "That Google account is not allowed to sign up for this planner."
      : "Sign in did not complete. Try again."
    : null;
  return <LoginForm callbackUrl={safeCallbackUrl(params?.callbackUrl)} notice={notice} />;
}
