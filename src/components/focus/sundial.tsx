import type { ReactNode } from "react";

interface SundialProps {
  /** 1 = whole goal still ahead (fully shaded), 0 = goal reached (fully lit). */
  fractionLeft: number;
  goalReached: boolean;
  children: ReactNode;
}

/**
 * The planned session as a disc. The time left is the shade lying across it;
 * it sweeps back clockwise as time passes, with an accent hand and rim dot at
 * "now".
 */
export function Sundial({ fractionLeft, goalReached, children }: SundialProps) {
  return (
    <div
      className="sundial relative aspect-square w-[min(78vw,340px)] rounded-full bg-[var(--sundial-lit)] shadow-[inset_0_0_0_1px_var(--line-strong)] lg:w-[380px]"
      style={{ "--left": fractionLeft.toFixed(5) } as React.CSSProperties}
    >
      <div className="sundial-shade absolute inset-0 rounded-full" aria-hidden="true" />
      <div className="sundial-hand absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-1/2 w-[3px] -translate-x-1/2 rounded-full bg-accent" />
        <div className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-[3px] ring-paper" />
      </div>
      <div
        key={goalReached ? "reached" : "running"}
        className={`absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-paper shadow-[0_0_0_1px_var(--line-strong),0_12px_32px_rgb(28_25_23/0.14)] ${
          goalReached ? "goal-pulse" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
