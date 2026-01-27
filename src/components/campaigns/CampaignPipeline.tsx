import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Mail, Eye, MessageSquareReply, Sparkles, CheckCircle } from "lucide-react";
import type { CampaignWithJob } from "./types";

interface CampaignPipelineProps {
  campaigns: CampaignWithJob[];
  onStageClick?: (stage: string) => void;
}

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const stages: PipelineStage[] = [
  { key: "sent", label: "Sent", icon: Mail, color: "bg-muted" },
  { key: "opened", label: "Opened", icon: Eye, color: "bg-accent" },
  { key: "replied", label: "Replied", icon: MessageSquareReply, color: "bg-primary" },
  { key: "interested", label: "Interested", icon: Sparkles, color: "bg-warning" },
  { key: "placed", label: "Placed", icon: CheckCircle, color: "bg-success" },
];

export const CampaignPipeline = ({
  campaigns,
  onStageClick,
}: CampaignPipelineProps) => {
  const pipelineData = useMemo(() => {
    const totals = campaigns.reduce(
      (acc, campaign) => ({
        sent: acc.sent + (campaign.emails_sent || 0) + (campaign.sms_sent || 0),
        opened: acc.opened + (campaign.emails_opened || 0),
        replied: acc.replied + (campaign.emails_replied || 0) + (campaign.sms_replied || 0),
        interested: acc.interested, // Would need to count from campaign_leads_v2
        placed: acc.placed, // Would need to count from campaign_leads_v2
      }),
      { sent: 0, opened: 0, replied: 0, interested: 0, placed: 0 }
    );

    // Calculate percentages relative to sent
    const getPercentage = (value: number) => {
      if (totals.sent === 0) return 0;
      return (value / totals.sent) * 100;
    };

    return stages.map((stage) => ({
      ...stage,
      value: totals[stage.key as keyof typeof totals],
      percentage: getPercentage(totals[stage.key as keyof typeof totals]),
    }));
  }, [campaigns]);

  // Calculate the max width (sent is always 100%)
  const maxValue = pipelineData[0]?.value || 0;

  return (
    <div className="rounded-xl bg-card shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-6">Campaign Pipeline</h3>

      <div className="space-y-4">
        {pipelineData.map((stage, index) => {
          const Icon = stage.icon;
          const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const conversionRate =
            index > 0 && pipelineData[index - 1].value > 0
              ? (stage.value / pipelineData[index - 1].value) * 100
              : 100;

          return (
            <div
              key={stage.key}
              className="group cursor-pointer"
              onClick={() => onStageClick?.(stage.key)}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      stage.color,
                      stage.key === "sent" && "bg-muted",
                      stage.key === "opened" && "bg-accent/20",
                      stage.key === "replied" && "bg-primary/20",
                      stage.key === "interested" && "bg-warning/20",
                      stage.key === "placed" && "bg-success/20"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        stage.key === "sent" && "text-muted-foreground",
                        stage.key === "opened" && "text-accent",
                        stage.key === "replied" && "text-primary",
                        stage.key === "interested" && "text-warning",
                        stage.key === "placed" && "text-success"
                      )}
                    />
                  </div>
                  <span className="font-medium text-sm text-foreground">
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-semibold text-foreground">
                    {stage.value.toLocaleString()}
                  </span>
                  {index > 0 && (
                    <span
                      className={cn(
                        "text-xs font-mono",
                        conversionRate >= 50
                          ? "text-success"
                          : conversionRate >= 20
                          ? "text-warning"
                          : "text-muted-foreground"
                      )}
                    >
                      {conversionRate.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Funnel Bar */}
              <div className="relative h-8">
                {/* Background */}
                <div className="absolute inset-0 bg-secondary/50 rounded-lg" />

                {/* Filled portion */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-500 group-hover:opacity-90",
                    stage.key === "sent" && "bg-muted-foreground/30",
                    stage.key === "opened" && "bg-accent/50",
                    stage.key === "replied" && "bg-primary/50",
                    stage.key === "interested" && "bg-warning/50",
                    stage.key === "placed" && "bg-success/50"
                  )}
                  style={{ width: `${Math.max(widthPercentage, 2)}%` }}
                />

                {/* Label inside bar */}
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-xs font-medium text-foreground/70">
                    {stage.percentage.toFixed(1)}% of total sent
                  </span>
                </div>
              </div>

              {/* Conversion Arrow */}
              {index < pipelineData.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-4 bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">
              {pipelineData[1]?.value > 0 && pipelineData[0]?.value > 0
                ? ((pipelineData[1].value / pipelineData[0].value) * 100).toFixed(0)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground">Open Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {pipelineData[2]?.value > 0 && pipelineData[0]?.value > 0
                ? ((pipelineData[2].value / pipelineData[0].value) * 100).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground">Reply Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-success">
              {pipelineData[4]?.value || 0}
            </p>
            <p className="text-xs text-muted-foreground">Placements</p>
          </div>
        </div>
      </div>
    </div>
  );
};
