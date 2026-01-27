import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JobHealthIndicatorProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const JobHealthIndicator = ({ 
  score, 
  size = "md",
  showLabel = false 
}: JobHealthIndicatorProps) => {
  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-success stroke-success";
    if (score >= 40) return "text-warning stroke-warning";
    return "text-destructive stroke-destructive";
  };

  const getHealthLabel = (score: number) => {
    if (score >= 70) return "Healthy";
    if (score >= 40) return "Needs Attention";
    return "At Risk";
  };

  const getHealthDetails = (score: number) => {
    const details = [];
    if (score < 70) {
      details.push("Consider increasing outreach frequency");
    }
    if (score < 50) {
      details.push("Pipeline has been stagnant");
    }
    if (score < 30) {
      details.push("No recent activity detected");
    }
    return details;
  };

  const sizeConfig = {
    sm: { width: 40, height: 40, strokeWidth: 4, radius: 16 },
    md: { width: 60, height: 60, strokeWidth: 5, radius: 24 },
    lg: { width: 80, height: 80, strokeWidth: 6, radius: 32 },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ width: config.width, height: config.height }}>
              {/* Background circle */}
              <svg
                className="rotate-[-90deg]"
                width={config.width}
                height={config.height}
              >
                <circle
                  cx={config.width / 2}
                  cy={config.height / 2}
                  r={config.radius}
                  fill="none"
                  strokeWidth={config.strokeWidth}
                  className="stroke-muted"
                />
                <circle
                  cx={config.width / 2}
                  cy={config.height / 2}
                  r={config.radius}
                  fill="none"
                  strokeWidth={config.strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={cn("transition-all duration-500", getHealthColor(score))}
                />
              </svg>
              {/* Center icon/indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "rounded-full",
                  size === "sm" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-4 h-4",
                  score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-destructive"
                )} />
              </div>
            </div>
            {showLabel && (
              <span className={cn("text-sm font-medium", getHealthColor(score))}>
                {getHealthLabel(score)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              Job Health: {score}% - {getHealthLabel(score)}
            </div>
            {getHealthDetails(score).length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-1">
                {getHealthDetails(score).map((detail, i) => (
                  <li key={i}>• {detail}</li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default JobHealthIndicator;
