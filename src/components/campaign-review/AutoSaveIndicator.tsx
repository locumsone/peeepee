import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AutoSaveIndicatorProps {
  lastSaved: Date | null;
  isDirty: boolean;
  isSaving?: boolean;
  className?: string;
}

export function AutoSaveIndicator({ 
  lastSaved, 
  isDirty, 
  isSaving = false,
  className 
}: AutoSaveIndicatorProps) {
  if (isSaving) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (isDirty) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-amber-500", className)}>
        <CloudOff className="h-3 w-3" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSaved) {
    const timeAgo = formatDistanceToNow(lastSaved, { addSuffix: true });
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Cloud className="h-3 w-3 text-green-500" />
        <span>Saved {timeAgo}</span>
      </div>
    );
  }

  return null;
}
