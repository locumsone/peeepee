import { useState, useEffect, ReactNode } from "react";
import { ChevronDown, ChevronUp, Check, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type StepStatus = "pending" | "in-progress" | "complete" | "blocked";

interface ReviewStepCardProps {
  stepNumber: number;
  title: string;
  subtitle?: string;
  status: StepStatus;
  collapsedSummary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  autoCollapseOnComplete?: boolean;
}

export function ReviewStepCard({
  stepNumber,
  title,
  subtitle,
  status,
  collapsedSummary,
  children,
  defaultOpen = true,
  autoCollapseOnComplete = true,
}: ReviewStepCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Auto-collapse when complete
  useEffect(() => {
    if (autoCollapseOnComplete && status === "complete") {
      setIsOpen(false);
    }
  }, [status, autoCollapseOnComplete]);

  const getStatusIcon = () => {
    switch (status) {
      case "complete":
        return <Check className="h-4 w-4 text-emerald-400" />;
      case "in-progress":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "complete":
        return "border-emerald-500/30 bg-emerald-500/5";
      case "in-progress":
        return "border-primary/30 bg-primary/5";
      case "blocked":
        return "border-red-500/30 bg-red-500/5";
      default:
        return "border-border bg-card";
    }
  };

  const getBadgeColor = () => {
    switch (status) {
      case "complete":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "in-progress":
        return "bg-primary/20 text-primary border-primary/30";
      case "blocked":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("rounded-lg border transition-all duration-200", getStatusColor())}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full border text-sm font-medium",
                getBadgeColor()
              )}>
                {status === "complete" ? getStatusIcon() : stepNumber}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{title}</span>
                  {!isOpen && collapsedSummary && status === "complete" && (
                    <span className="text-sm text-muted-foreground">· {collapsedSummary}</span>
                  )}
                </div>
                {subtitle && isOpen && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status !== "complete" && status !== "pending" && getStatusIcon()}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
