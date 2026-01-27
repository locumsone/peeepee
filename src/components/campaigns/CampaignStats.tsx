import { Activity, Pause, CheckCircle2, Users, TrendingUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignStatsProps {
  activeCount: number;
  pausedCount: number;
  completedCount: number;
  draftCount: number;
  totalLeads: number;
  avgOpenRate: number;
  avgReplyRate: number;
  hotLeadsCount: number;
}

export const CampaignStats = ({
  activeCount,
  pausedCount,
  completedCount,
  draftCount,
  totalLeads,
  avgOpenRate,
  avgReplyRate,
  hotLeadsCount,
}: CampaignStatsProps) => {
  const stats = [
    {
      label: "Campaigns",
      primary: `${activeCount}`,
      secondary: `Active`,
      sublabel: `${draftCount} draft, ${pausedCount} paused`,
      icon: Activity,
      color: "success" as const,
    },
    {
      label: "Total Leads",
      primary: totalLeads.toLocaleString(),
      secondary: null,
      sublabel: `${hotLeadsCount} hot leads`,
      icon: Users,
      color: "primary" as const,
    },
    {
      label: "Open Rate",
      primary: `${avgOpenRate.toFixed(0)}%`,
      secondary: null,
      sublabel: avgOpenRate >= 30 ? "Above target" : "Below 30% target",
      icon: TrendingUp,
      color: avgOpenRate >= 30 ? "success" as const : "warning" as const,
    },
    {
      label: "Reply Rate",
      primary: `${avgReplyRate.toFixed(1)}%`,
      secondary: null,
      sublabel: `${completedCount} completed`,
      icon: CheckCircle2,
      color: avgReplyRate >= 5 ? "success" as const : "muted" as const,
    },
    {
      label: "Hot Leads",
      primary: hotLeadsCount.toString(),
      secondary: null,
      sublabel: "Interested signals",
      icon: Flame,
      color: "warning" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "rounded-xl bg-card shadow-card p-4 border-l-4",
              stat.color === "success" && "border-success",
              stat.color === "warning" && "border-warning",
              stat.color === "primary" && "border-primary",
              stat.color === "muted" && "border-muted-foreground"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  stat.color === "success" && "bg-success/10",
                  stat.color === "warning" && "bg-warning/10",
                  stat.color === "primary" && "bg-primary/10",
                  stat.color === "muted" && "bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    stat.color === "success" && "text-success",
                    stat.color === "warning" && "text-warning",
                    stat.color === "primary" && "text-primary",
                    stat.color === "muted" && "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold text-foreground">{stat.primary}</p>
                  {stat.secondary && (
                    <span className="text-xs text-muted-foreground">{stat.secondary}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/70 truncate">{stat.sublabel}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
