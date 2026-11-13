"use client";

import { useState, useTransition } from "react";
import { replanWeekAction } from "@/actions/planner";
import { Button } from "@/components/ui/button";
import { RefreshIcon } from "@/components/ui/icons";

interface ReplanButtonProps {
  label?: string;
  variant?: "primary" | "ghost";
}

/** Replans today through the next six days and refreshes the page. */
export function ReplanButton({ label = "Replan", variant = "ghost" }: ReplanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-[13px] text-danger">{error}</span>}
      <Button
        variant={variant}
        size={variant === "primary" ? "md" : "sm"}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await replanWeekAction();
            if (!result.success) {
              setError(result.error);
              return;
            }
          })
        }
      >
        <RefreshIcon className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Planning…" : label}
      </Button>
    </div>
  );
}
