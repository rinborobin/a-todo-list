"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { savePushSubscriptionAction } from "@/actions/reminders";
import { CloseIcon } from "@/components/ui/icons";
import { detectDevice } from "./push-client";

const DISMISSED_KEY = "reminders-nudge-dismissed";

/**
 * One quiet line on Today while reminders are off on this device. It also
 * keeps the server in step with a device that is already subscribed, since
 * Today is where the app opens.
 */
export function RemindersNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    detectDevice().then((found) => {
      if (found.subscription) {
        void savePushSubscriptionAction(found.subscription);
        return;
      }
      if (found.state !== "off" && found.state !== "needs-install") return;
      let dismissed = false;
      try {
        dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
      } catch {
        // Private browsing: show the line, it just cannot be remembered as dismissed.
      }
      if (alive && !dismissed) setShow(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  return (
    <p className="enter mt-4 flex items-center justify-between gap-3 border-l border-line-strong pl-4 text-sm text-muted">
      <span>
        Reminders are off.{" "}
        <Link href="/me#reminders" className="font-medium text-ink underline underline-offset-4">
          Turn on
        </Link>
      </span>
      <button
        type="button"
        aria-label="Hide this"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // Nothing to remember it with.
          }
          setShow(false);
        }}
        className="-mr-2 rounded-lg p-2 hover:bg-line/60 hover:text-ink"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </p>
  );
}
