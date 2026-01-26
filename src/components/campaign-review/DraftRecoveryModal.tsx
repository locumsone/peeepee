import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface DraftRecoveryModalProps {
  open: boolean;
  lastSavedAt: string;
  campaignName?: string;
  candidateCount: number;
  currentStep: number;
  onRecover: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

const STEP_NAMES = ["Select Job", "Select Candidates", "Configure Channels", "Review & Launch"];

export function DraftRecoveryModal({
  open,
  lastSavedAt,
  campaignName,
  candidateCount,
  currentStep,
  onRecover,
  onDiscard,
  onDismiss,
}: DraftRecoveryModalProps) {
  const timeAgo = formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true });
  const stepName = STEP_NAMES[Math.min(currentStep - 1, STEP_NAMES.length - 1)];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>Resume Draft?</DialogTitle>
              <DialogDescription>
                We found an unsaved campaign draft
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            {campaignName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Campaign</span>
                <span className="font-medium text-foreground">{campaignName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Candidates</span>
              <span className="font-medium text-foreground">{candidateCount} selected</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">Step {currentStep}: {stepName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last saved</span>
              <span className="font-medium text-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onDiscard} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Start Fresh
          </Button>
          <Button onClick={onRecover} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Resume Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
