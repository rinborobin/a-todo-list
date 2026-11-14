"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const CLOSE_MS = 200;

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to close
 * and the backdrop come from the browser. Slides up as a sheet on phones and
 * sits centred on larger screens. Closing from inside (the X, the backdrop,
 * Escape) plays the way out before telling the parent.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      closing.current = false;
      dialog.removeAttribute("data-closing");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const requestClose = useCallback(() => {
    const dialog = ref.current;
    if (!dialog || closing.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    closing.current = true;
    dialog.setAttribute("data-closing", "");
    window.setTimeout(() => {
      closing.current = false;
      onClose();
    }, CLOSE_MS);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: animate out instead of the browser closing at once.
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (!closing.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) requestClose();
      }}
      className="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-sheet p-0 text-ink shadow-xl sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-5">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-serif text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-2 rounded-lg p-2 text-muted hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
