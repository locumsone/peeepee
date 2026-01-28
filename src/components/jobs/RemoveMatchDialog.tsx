import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RemoveMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  count?: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const RemoveMatchDialog = ({
  open,
  onOpenChange,
  candidateName,
  count,
  onConfirm,
  isLoading = false,
}: RemoveMatchDialogProps) => {
  const isBulk = count && count > 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {isBulk ? "Candidates" : "Candidate"} from Matches?</AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>
                This will remove <strong>{count} candidates</strong> from matched candidates for this job.
                They won't be considered for outreach unless re-matched.
              </>
            ) : (
              <>
                This will remove <strong>{candidateName}</strong> from matched candidates for this job.
                They won't be considered for outreach unless re-matched.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Removing..." : `Remove ${isBulk ? `${count} Candidates` : "Match"}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveMatchDialog;
