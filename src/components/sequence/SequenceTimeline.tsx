import { Mail, MessageSquare, Phone, CheckCircle2, AlertCircle, Loader2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SequenceStep {
  id: string;
  day: number;
  channel: 'email' | 'sms' | 'call' | 'linkedin';
  type: 'initial' | 'followup' | 'reply';
  subject?: string;
  content: string;
  enabled: boolean;
  fromPersonalization?: boolean;
}

interface SequenceTimelineProps {
  steps: SequenceStep[];
  activeStepId: string;
  onSelectStep: (stepId: string) => void;
  onToggleStep: (stepId: string) => void;
  generatingStepIds?: string[];
}

export function SequenceTimeline({
  steps,
  activeStepId,
  onSelectStep,
  onToggleStep,
  generatingStepIds = [],
}: SequenceTimelineProps) {
  // Group steps by day
  const stepsByDay = steps.reduce((acc, step) => {
    const day = step.day;
    if (!acc[day]) acc[day] = [];
    acc[day].push(step);
    return acc;
  }, {} as Record<number, SequenceStep[]>);

  const days = Object.keys(stepsByDay).map(Number).sort((a, b) => a - b);

  const getChannelIcon = (channel: string, className?: string) => {
    const iconClass = cn("h-4 w-4", className);
    switch (channel) {
      case 'email': return <Mail className={iconClass} />;
      case 'sms': return <MessageSquare className={iconClass} />;
      case 'call': return <Phone className={iconClass} />;
      default: return null;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email': return "text-blue-500 bg-blue-500/10 border-blue-500/30";
      case 'sms': return "text-green-500 bg-green-500/10 border-green-500/30";
      case 'call': return "text-purple-500 bg-purple-500/10 border-purple-500/30";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getStepStatus = (step: SequenceStep) => {
    if (generatingStepIds.includes(step.id)) return 'generating';
    if (step.content && step.content.trim()) return 'ready';
    return 'empty';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'generating':
        return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case 'empty':
        return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <ScrollArea className="h-[420px]">
      <div className="p-4 space-y-1">
        {days.map((day, dayIdx) => (
          <div key={day} className="relative">
            {/* Day Header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                {day}
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Day {day}
              </span>
            </div>

            {/* Steps for this day */}
            <div className="ml-4 pl-4 border-l-2 border-border space-y-2 pb-4">
              {stepsByDay[day].map((step) => {
                const status = getStepStatus(step);
                const isActive = step.id === activeStepId;
                const isCall = step.channel === 'call';

                return (
                  <div
                    key={step.id}
                    onClick={() => !isCall && onSelectStep(step.id)}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-lg transition-all border",
                      isCall && "opacity-50 cursor-not-allowed",
                      !isCall && "cursor-pointer",
                      isActive && !isCall
                        ? "bg-primary/10 border-primary/50 shadow-sm"
                        : "hover:bg-secondary/50 border-transparent",
                      !step.enabled && "opacity-40"
                    )}
                  >
                    {/* Connector dot */}
                    <div className={cn(
                      "absolute -left-[21px] w-3 h-3 rounded-full border-2 border-background",
                      status === 'ready' ? "bg-green-500" :
                      status === 'generating' ? "bg-primary" :
                      "bg-muted-foreground/30"
                    )} />

                    {/* Channel icon */}
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg border",
                      getChannelColor(step.channel)
                    )}>
                      {getChannelIcon(step.channel)}
                    </div>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {step.channel}
                        </span>
                        {step.type === 'initial' && step.fromPersonalization && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">
                            From Step 3
                          </Badge>
                        )}
                        {isCall && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {step.content
                          ? step.content.substring(0, 35) + (step.content.length > 35 ? "..." : "")
                          : "No content yet"}
                      </p>
                    </div>

                    {/* Status & Toggle */}
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {!isCall && (
                        <Switch
                          checked={step.enabled}
                          onCheckedChange={() => onToggleStep(step.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="scale-75"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Connector line between days */}
            {dayIdx < days.length - 1 && (
              <div className="absolute left-4 -bottom-1 w-px h-2 bg-border" />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
