import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, Mail, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "sms" | "call" | "email";
  direction: "inbound" | "outbound";
  content: string;
  candidateName: string | null;
  createdAt: string;
}

interface JobQuickActivityProps {
  jobId: string;
  limit?: number;
}

export const JobQuickActivity = ({ jobId, limit = 5 }: JobQuickActivityProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [jobId]);

  const fetchActivities = async () => {
    setIsLoading(true);
    const allActivities: ActivityItem[] = [];

    try {
      // Fetch AI call logs for this job
      const { data: callData } = await supabase
        .from("ai_call_logs")
        .select("id, candidate_name, call_summary, call_result, call_type, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (callData) {
        callData.forEach((call) => {
          allActivities.push({
            id: `call-${call.id}`,
            type: "call",
            direction: call.call_type === "inbound" ? "inbound" : "outbound",
            content: call.call_summary || call.call_result || "Call",
            candidateName: call.candidate_name,
            createdAt: call.created_at || "",
          });
        });
      }

      // Fetch recent activity log entries for this job
      const { data: activityData } = await supabase
        .from("activity_log")
        .select("id, action_type, metadata, created_at, user_name")
        .eq("job_id", jobId)
        .in("action_type", ["sms_sent", "sms_received", "email_sent", "email_opened", "email_replied"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (activityData) {
        activityData.forEach((activity) => {
          const isSMS = activity.action_type.includes("sms");
          const isInbound = activity.action_type.includes("received") || activity.action_type.includes("replied");
          
          allActivities.push({
            id: `activity-${activity.id}`,
            type: isSMS ? "sms" : "email",
            direction: isInbound ? "inbound" : "outbound",
            content: activity.action_type.replace(/_/g, " "),
            candidateName: (activity.metadata as any)?.candidate_name || activity.user_name || null,
            createdAt: activity.created_at || "",
          });
        });
      }

      // Sort by date and limit
      allActivities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(allActivities.slice(0, limit));
    } catch (err) {
      console.error("Error fetching quick activities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "sms": return MessageSquare;
      case "call": return Phone;
      case "email": return Mail;
      default: return MessageSquare;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "sms": return "text-blue-400";
      case "call": return "text-green-400";
      case "email": return "text-purple-400";
      default: return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        const Icon = getActivityIcon(activity.type);
        const iconColor = getActivityColor(activity.type);

        return (
          <div
            key={activity.id}
            className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 text-sm"
          >
            <div className={cn(
              "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
              "bg-muted"
            )}>
              <Icon className={cn("h-3 w-3", iconColor)} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground truncate">
                  {activity.candidateName || "Unknown"}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1 py-0",
                    activity.direction === "inbound" 
                      ? "border-success/30 text-success" 
                      : "border-primary/30 text-primary"
                  )}
                >
                  {activity.direction === "inbound" ? (
                    <ArrowDown className="h-2 w-2" />
                  ) : (
                    <ArrowUp className="h-2 w-2" />
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs truncate">
                {activity.content}
              </p>
            </div>

            <div className="flex items-center text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5 mr-0.5" />
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default JobQuickActivity;
