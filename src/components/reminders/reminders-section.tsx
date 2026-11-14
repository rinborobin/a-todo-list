"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestReminderAction,
  updateReminderPrefsAction,
  type ReminderState,
} from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import type { ReminderPrefs } from "@/lib/reminders/due";
import { detectDevice, subscribeDevice, unsubscribeDevice, type DeviceState } from "./push-client";

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

type Note = { tone: "ok" | "error"; text: string } | null;

/**
 * Reminders on Me. Whether they are on is a fact about this device, so the
 * section waits for the browser before it shows anything to tap.
 */
export function RemindersSection({ state }: { state: ReminderState }) {
  const [device, setDevice] = useState<DeviceState | "checking">("checking");
  const [prefs, setPrefs] = useState<ReminderPrefs>(state.prefs);
  const [morningTime, setMorningTime] = useState(state.prefs.morningTime);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    if (!state.configured) return;
    let alive = true;
    detectDevice().then(async (found) => {
      // Keep the server in step with a device that is already subscribed.
      const kept = found.subscription ? (await savePushSubscriptionAction(found.subscription)).success : true;
      if (alive) setDevice(kept ? found.state : "off");
    });
    return () => {
      alive = false;
    };
  }, [state.configured]);

  async function turnOn() {
    if (!state.publicKey) return;
    setBusy(true);
    setNote(null);
    const result = await subscribeDevice(state.publicKey);
    if (result.status !== "ok") {
      if (result.status === "blocked") setDevice("blocked");
      else if (result.status === "dismissed") {
        setNote({ tone: "error", text: "Notifications were not allowed, so reminders stay off." });
      } else setNote({ tone: "error", text: "This device could not be set up for reminders. Try again." });
    } else {
      const saved = await savePushSubscriptionAction(result.subscription);
      if (!saved.success) {
        await unsubscribeDevice();
        setNote({ tone: "error", text: saved.error });
      } else {
        setDevice("on");
        const test = await sendTestReminderAction();
        setNote(
          test.success
            ? { tone: "ok", text: "Reminders are on. A test notification is on its way." }
            : { tone: "ok", text: "Reminders are on." }
        );
      }
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setNote(null);
    const endpoint = await unsubscribeDevice();
    if (endpoint) await removePushSubscriptionAction({ endpoint });
    setDevice("off");
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setNote(null);
    const result = await sendTestReminderAction();
    setNote(result.success ? { tone: "ok", text: "Sent. It should arrive in a moment." } : { tone: "error", text: result.error });
    setBusy(false);
  }

  async function savePrefs(changes: Partial<ReminderPrefs>) {
    const previous = prefs;
    setPrefs({ ...prefs, ...changes });
    setNote(null);
    const result = await updateReminderPrefsAction(changes);
    if (result.success) {
      setPrefs(result.data);
      setMorningTime(result.data.morningTime);
    } else {
      setPrefs(previous);
      setMorningTime(previous.morningTime);
      setNote({ tone: "error", text: result.error });
    }
  }

  return (
    <section id="reminders" aria-labelledby="reminders-heading" className="scroll-mt-6">
      <h2 id="reminders-heading" className={`mb-3 ${sectionTitle}`}>
        Reminders
      </h2>

      {!state.configured ? (
        <p className="text-[15px] text-muted">Reminders are not set up yet.</p>
      ) : device === "checking" ? (
        <p className="text-[15px] text-muted" aria-live="polite">
          Checking this device…
        </p>
      ) : device === "unsupported" ? (
        <p className="text-[15px] text-muted">This browser cannot show notifications.</p>
      ) : device === "needs-install" ? (
        <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
          Reminders work once the app is on your Home Screen. In Safari, tap Share, then Add to Home Screen. Open the
          app from there and come back to this page.
        </p>
      ) : device === "blocked" ? (
        <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
          Notifications are blocked for this app. Allow them in the phone settings, then come back to this page.
        </p>
      ) : device === "off" ? (
        <div>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
            A summary each morning, a nudge a day and 2 hours before a deadline, and one when something is overdue.
          </p>
          <Button variant="primary" className="mt-4" disabled={busy} onClick={turnOn}>
            {busy ? "Turning on…" : "Turn on reminders"}
          </Button>
        </div>
      ) : (
        <div>
          <ul className="divide-y divide-line border-y border-line">
            <Row label="Morning summary" hint="What is due, overdue and planned today">
              {prefs.morningEnabled && (
                <>
                  <label htmlFor="morning-time" className="sr-only">
                    Morning summary time
                  </label>
                  <input
                    id="morning-time"
                    type="time"
                    value={morningTime}
                    onChange={(e) => setMorningTime(e.target.value)}
                    onBlur={() => {
                      if (morningTime && morningTime !== prefs.morningTime) savePrefs({ morningTime });
                    }}
                    className="tabular h-9 rounded-lg border border-line-strong bg-sheet px-2 text-base text-ink focus:border-ink sm:text-sm"
                  />
                </>
              )}
              <Switch
                label="Morning summary"
                checked={prefs.morningEnabled}
                onChange={(morningEnabled) => savePrefs({ morningEnabled })}
              />
            </Row>
            <Row label="Before a deadline" hint="A day before and 2 hours before">
              <Switch
                label="Before a deadline"
                checked={prefs.deadlineEnabled}
                onChange={(deadlineEnabled) => savePrefs({ deadlineEnabled })}
              />
            </Row>
            <Row label="Overdue" hint="When a deadline passes">
              <Switch
                label="Overdue"
                checked={prefs.overdueEnabled}
                onChange={(overdueEnabled) => savePrefs({ overdueEnabled })}
              />
            </Row>
          </ul>

          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted">
            Nothing is sent between 22:00 and 07:00. Times follow your time zone, {state.timezone}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={sendTest}>
              Send a test
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={turnOff}>
              Turn off on this device
            </Button>
          </div>
        </div>
      )}

      {note && (
        <p role="status" className={`mt-3 text-sm ${note.tone === "error" ? "text-danger" : "text-ink-soft"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-[13px] text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </li>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-line-strong"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-sheet shadow-sm motion-safe:transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
