"use client";

import type { Task } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface DeleteTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteTaskDialog({ task, isOpen, onClose, onConfirm, isDeleting }: DeleteTaskDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} title="Delete task?">
      <p className="text-[15px] text-ink-soft">
        <span className="font-medium text-ink">{task.title}</span> will be deleted, along with any upcoming blocks
        planned for it. This cannot be undone.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onClose} disabled={isDeleting}>
          Keep it
        </Button>
        <Button variant="danger" onClick={() => onConfirm(task.id)} disabled={isDeleting}>
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Dialog>
  );
}
