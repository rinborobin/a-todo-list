import { getFocusQuery } from "@/actions/study";
import { FocusView } from "@/components/focus/focus-view";

export const metadata = {
  title: "Focus",
};

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [focus, params] = await Promise.all([getFocusQuery(), searchParams]);
  // No server redirect when there is no running timer: stopping refreshes this
  // page, and the focus view must stay mounted to show the finish screen. The
  // view itself returns to Today when it was opened without a running timer.
  return <FocusView data={focus} initialNow={new Date()} entering={params.from === "start"} />;
}
