import { cn } from "@/lib/utils";

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  color: string;
}

const PIPELINE_STAGES: { id: string; label: string; color: string }[] = [
  { id: "sourced", label: "Sourced", color: "bg-muted" },
  { id: "contacted", label: "Contacted", color: "bg-blue-500/30" },
  { id: "engaged", label: "Engaged", color: "bg-warning/30" },
  { id: "interested", label: "Interested", color: "bg-success/30" },
  { id: "submitted", label: "Submitted", color: "bg-purple-500/30" },
  { id: "placed", label: "Placed", color: "bg-emerald-500/30" },
  { id: "not_interested", label: "Not Interested", color: "bg-destructive/30" },
];

interface JobPipelineProps {
  counts: Record<string, number>;
  compact?: boolean;
  onStageClick?: (stageId: string) => void;
}

export const JobPipeline = ({ counts, compact = false, onStageClick }: JobPipelineProps) => {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  const stages = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: counts[stage.id] || 0,
    percentage: total > 0 ? ((counts[stage.id] || 0) / total) * 100 : 0,
  }));

  if (compact) {
    // Compact bar for job cards
    return (
      <div className="space-y-1">
        <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
          {stages.map((stage) => (
            stage.count > 0 && (
              <div
                key={stage.id}
                className={cn(stage.color, "transition-all")}
                style={{ width: `${stage.percentage}%` }}
              />
            )
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{total} candidates</span>
          {counts.interested > 0 && (
            <span className="text-success">• {counts.interested} interested</span>
          )}
        </div>
      </div>
    );
  }

  // Full pipeline view for job detail
  return (
    <div className="space-y-4">
      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/30">
        {stages.map((stage) => (
          stage.count > 0 && (
            <div
              key={stage.id}
              className={cn(stage.color, "transition-all cursor-pointer hover:opacity-80")}
              style={{ width: `${stage.percentage}%` }}
              onClick={() => onStageClick?.(stage.id)}
              title={`${stage.label}: ${stage.count}`}
            />
          )
        ))}
      </div>
      
      {/* Stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => onStageClick?.(stage.id)}
            className={cn(
              "rounded-lg border border-border p-3 text-center transition-all hover:border-primary/50",
              stage.count > 0 ? stage.color : "bg-muted/20 opacity-50"
            )}
          >
            <div className="text-2xl font-bold text-foreground">{stage.count}</div>
            <div className="text-xs text-muted-foreground">{stage.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default JobPipeline;
