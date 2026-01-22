import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OperationProgressProps {
  isActive: boolean;
  label: string;
  current?: number;
  total?: number;
  status?: "loading" | "success" | "error";
  className?: string;
}

export const OperationProgress = ({
  isActive,
  label,
  current = 0,
  total = 0,
  status = "loading",
  className,
}: OperationProgressProps) => {
  if (!isActive) return null;

  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  const isIndeterminate = total === 0;

  return (
    <div className={cn("flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border", className)}>
      <div className="flex items-center gap-2">
        {status === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {status === "success" && (
          <CheckCircle2 className="h-4 w-4 text-success" />
        )}
        {status === "error" && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">{label}</span>
        {total > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {current} / {total}
          </span>
        )}
      </div>
      {isIndeterminate ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/3 animate-pulse bg-primary rounded-full" />
        </div>
      ) : (
        <Progress value={progress} className="h-2" />
      )}
    </div>
  );
};

// Multi-operation progress tracker
export interface MultiOperationProgressProps {
  operations: {
    id: string;
    label: string;
    isActive: boolean;
    current?: number;
    total?: number;
    status?: "loading" | "success" | "error";
  }[];
  className?: string;
}

export const MultiOperationProgress = ({
  operations,
  className,
}: MultiOperationProgressProps) => {
  const activeOperations = operations.filter((op) => op.isActive);

  if (activeOperations.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {activeOperations.map((op) => (
        <OperationProgress
          key={op.id}
          isActive={op.isActive}
          label={op.label}
          current={op.current}
          total={op.total}
          status={op.status}
        />
      ))}
    </div>
  );
};
