"use client";

/**
 * Last-resort error page when the root layout itself fails. It replaces the
 * whole document, so it carries its own minimal Paper styles.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · Daily Planner</title>
        <style>{`
          :root { --paper:#f6f3ec; --ink:#1c1917; --muted:#57534e; --accent:#c2410c; color-scheme: light; }
          @media (prefers-color-scheme: dark) {
            :root { --paper:#171512; --ink:#ede8de; --muted:#a39d93; --accent:#f08a5d; color-scheme: dark; }
          }
          body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
                 background:var(--paper); color:var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; padding:20px; }
          .box { max-width:28rem; border-left:2px solid var(--accent); padding-left:20px; }
          h1 { font-family: ui-serif, Georgia, serif; font-weight:400; font-size:30px; line-height:1.2; margin:0; }
          p { color:var(--muted); font-size:15px; line-height:1.5; }
          button { margin-top:12px; height:44px; padding:0 16px; border:0; border-radius:12px;
                   background:var(--ink); color:var(--paper); font-size:14px; font-weight:500; cursor:pointer; }
        `}</style>
        <div className="box">
          <h1>The planner hit a problem.</h1>
          <p>Your data is safe. Try again in a moment.</p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
