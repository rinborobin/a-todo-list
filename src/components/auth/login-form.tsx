"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { GoogleSignInButton } from "./oauth-button";
import { loginSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";

interface LoginFormProps {
  callbackUrl?: string;
  notice?: string | null;
}

export function LoginForm({ callbackUrl = "/today", notice = null }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const formatted = result.error.format();
      setFieldErrors({
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await signIn.email({ email, password });

      if (response.error) {
        // Generic message to avoid account enumeration
        setError(response.error.message || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Try again.");
      setIsLoading(false);
    }
  };

  const registerHref = `/register${callbackUrl !== "/today" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;

  return (
    <div>
      <h1 className="font-serif text-[32px] leading-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">To see today&apos;s plan and what is due.</p>

      {notice && (
        <div className="mt-6">
          <ErrorNote>{notice}</ErrorNote>
        </div>
      )}

      <div className="mt-8">
        <GoogleSignInButton callbackUrl={callbackUrl} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </Field>

        <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        No account yet?{" "}
        <Link href={registerHref} className="font-medium text-ink underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
