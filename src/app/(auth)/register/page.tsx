import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create an account",
  description: "Create an AI Daily Planner account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/dashboard";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <RegisterForm callbackUrl={callbackUrl} />
    </div>
  );
}