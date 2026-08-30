import { useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2, type LucideIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: LucideIcon;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  icon: Icon = AlertTriangle,
  onConfirm,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground shadow-2xl">
        <DialogHeader className="border-b border-border bg-secondary/50 px-5 py-5 text-left">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                destructive
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="font-serif text-lg leading-tight tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 border-t border-border bg-card px-5 py-4 sm:space-x-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
