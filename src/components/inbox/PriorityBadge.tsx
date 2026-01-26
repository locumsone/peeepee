import { Flame, Star, Thermometer, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PriorityLevel = "urgent" | "hot" | "warm" | "cold";

interface PriorityBadgeProps {
  level: PriorityLevel;
  score?: number;
  showScore?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const priorityConfig: Record<PriorityLevel, {
  icon: React.ReactNode;
  label: string;
  className: string;
  iconClassName: string;
}> = {
  urgent: {
    icon: <Flame className="h-3 w-3" />,
    label: "Urgent",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    iconClassName: "text-red-400 animate-pulse",
  },
  hot: {
    icon: <Star className="h-3 w-3" />,
    label: "Hot",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    iconClassName: "text-orange-400",
  },
  warm: {
    icon: <Thermometer className="h-3 w-3" />,
    label: "Warm",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    iconClassName: "text-yellow-400",
  },
  cold: {
    icon: <Snowflake className="h-3 w-3" />,
    label: "Cold",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    iconClassName: "text-blue-400",
  },
};

export const calculatePriorityLevel = (params: {
  unreadCount?: number;
  repliedRecently?: boolean;
  sentiment?: string;
  callbackRequested?: boolean;
  emailOpens?: number;
  hasRequiredLicense?: boolean;
  daysSinceLastContact?: number;
  optedOut?: boolean;
}): { level: PriorityLevel; score: number } => {
  let score = 50; // Base score

  // Positive signals
  if (params.repliedRecently) score += 30;
  if (params.sentiment === "interested") score += 25;
  if (params.callbackRequested) score += 20;
  if ((params.emailOpens || 0) >= 3) score += 15;
  if (params.hasRequiredLicense) score += 10;
  if ((params.unreadCount || 0) > 0) score += 10;

  // Negative signals
  if ((params.daysSinceLastContact || 0) > 7) score -= 15;
  if ((params.daysSinceLastContact || 0) > 30) score -= 25;
  if (params.sentiment === "not_interested") score -= 30;
  if (params.optedOut) score = 0;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: PriorityLevel;
  if (score >= 80) {
    level = "urgent";
  } else if (score >= 50) {
    level = "hot";
  } else if (score >= 20) {
    level = "warm";
  } else {
    level = "cold";
  }

  return { level, score };
};

export const PriorityBadge = ({ 
  level, 
  score, 
  showScore = false, 
  size = "sm",
  className 
}: PriorityBadgeProps) => {
  const config = priorityConfig[level];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border",
        config.className,
        size === "sm" && "text-[10px] px-1.5 py-0",
        size === "md" && "text-xs px-2 py-0.5",
        className
      )}
    >
      <span className={config.iconClassName}>{config.icon}</span>
      <span>{config.label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
    </Badge>
  );
};

// Compact version for list items
export const PriorityDot = ({ level, className }: { level: PriorityLevel; className?: string }) => {
  const dotColors: Record<PriorityLevel, string> = {
    urgent: "bg-red-500 animate-pulse",
    hot: "bg-orange-500",
    warm: "bg-yellow-500",
    cold: "bg-blue-400",
  };

  return (
    <div 
      className={cn(
        "w-2 h-2 rounded-full",
        dotColors[level],
        className
      )} 
      title={`Priority: ${level}`}
    />
  );
};
