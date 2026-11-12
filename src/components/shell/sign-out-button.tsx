"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        disabled={isSigningOut}
        onClick={async () => {
          setIsSigningOut(true);
          setError(null);
          try {
            await signOut();
            router.push("/login");
            router.refresh();
          } catch {
            setError("Could not sign out. Try again.");
            setIsSigningOut(false);
          }
        }}
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
