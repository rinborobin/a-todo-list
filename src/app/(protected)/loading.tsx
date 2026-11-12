/**
 * Shown while a signed-in page loads (slow mobile data, cold starts).
 * Mirrors the page shape so content does not jump when it arrives.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto max-w-5xl animate-pulse px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10"
    >
      <div className="h-4 w-24 rounded bg-line" />
      <div className="mt-2 h-9 w-56 rounded-lg bg-line" />

      <div className="mt-8 ml-[9px] space-y-6 border-l border-line pl-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-line" />
            <div className="h-4 w-2/3 rounded bg-line" />
            <div className="h-3 w-28 rounded bg-line" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
