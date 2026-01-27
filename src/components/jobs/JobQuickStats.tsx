import { Users, UserCheck, MessageSquare, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobHealthIndicator } from "./JobHealthIndicator";

interface JobQuickStatsProps {
  matchedCount: number;
  pipelineCount: number;
  totalReplies: number;
  daysOpen: number;
  healthScore: number;
}

export const JobQuickStats = ({
  matchedCount,
  pipelineCount,
  totalReplies,
  daysOpen,
  healthScore,
}: JobQuickStatsProps) => {
  const stats = [
    {
      label: "Matched",
      value: matchedCount,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "In Pipeline",
      value: pipelineCount,
      icon: UserCheck,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Replies",
      value: totalReplies,
      icon: MessageSquare,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Days Open",
      value: daysOpen,
      icon: Clock,
      color: daysOpen > 30 ? "text-warning" : "text-muted-foreground",
      bgColor: daysOpen > 30 ? "bg-warning/10" : "bg-muted/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "rounded-xl border border-border p-4 transition-all hover:border-primary/30",
            "bg-card hover:shadow-lg hover:shadow-primary/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", stat.bgColor)}>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Health Score */}
      <div
        className={cn(
          "rounded-xl border border-border p-4 transition-all hover:border-primary/30",
          "bg-card hover:shadow-lg hover:shadow-primary/5"
        )}
      >
        <div className="flex items-center gap-3">
          <JobHealthIndicator score={healthScore} size="sm" />
          <div>
            <div className="text-2xl font-bold text-foreground">{healthScore}%</div>
            <div className="text-xs text-muted-foreground">Health</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobQuickStats;
