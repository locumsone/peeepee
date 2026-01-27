import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type HealthStatus = "healthy" | "warning" | "critical";

interface CampaignHealthIndicatorProps {
  emailsSent: number;
  emailsOpened: number;
  emailsBounced?: number;
  className?: string;
}

export const calculateHealth = (
  sent: number,
  opened: number,
  bounced: number = 0
): HealthStatus => {
  if (sent === 0) return "warning";
  
  const openRate = (opened / sent) * 100;
  const bounceRate = (bounced / sent) * 100;
  
  // Critical if bounce rate is too high
  if (bounceRate > 10) return "critical";
  
  // Based on open rate thresholds
  if (openRate >= 30) return "healthy";
  if (openRate >= 15) return "warning";
  return "critical";
};

export const getHealthLabel = (health: HealthStatus): string => {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Needs Attention";
    case "critical":
      return "Low Engagement";
  }
};

export const getHealthDescription = (
  health: HealthStatus,
  openRate: number
): string => {
  switch (health) {
    case "healthy":
      return `Open rate ${openRate.toFixed(0)}% is above target (30%)`;
    case "warning":
      return `Open rate ${openRate.toFixed(0)}% is below target. Consider adjusting subject lines.`;
    case "critical":
      return `Open rate ${openRate.toFixed(0)}% is critically low. Review deliverability and content.`;
  }
};

export const CampaignHealthIndicator = ({
  emailsSent,
  emailsOpened,
  emailsBounced = 0,
  className,
}: CampaignHealthIndicatorProps) => {
  const health = calculateHealth(emailsSent, emailsOpened, emailsBounced);
  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0 cursor-help",
              health === "healthy" && "bg-success shadow-[0_0_6px_hsl(var(--success))]",
              health === "warning" && "bg-warning shadow-[0_0_6px_hsl(var(--warning))]",
              health === "critical" && "bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-semibold">{getHealthLabel(health)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {getHealthDescription(health, openRate)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
