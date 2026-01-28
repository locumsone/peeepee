import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Phone, Mail, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "sms" | "call" | "email";
  direction: "inbound" | "outbound";
  content: string;
  candidateName: string | null;
  phone?: string;
  createdAt: string;
  status?: string;
  duration?: number;
}

interface JobActivityFeedProps {
  jobId: string;
  campaignIds: string[];
  candidateIds: string[];
  limit?: number;
}

export const JobActivityFeed = ({ 
  jobId, 
  campaignIds, 
  candidateIds,
  limit = 50 
}: JobActivityFeedProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [jobId, campaignIds, candidateIds]);

  const fetchActivities = async () => {
    setIsLoading(true);
    const allActivities: ActivityItem[] = [];

    try {
      // Fetch SMS messages via conversations linked to campaigns (only if campaigns exist)
      if (campaignIds.length > 0) {
        const { data: smsData } = await supabase
          .from("sms_messages")
          .select(`
            id,
            body,
            direction,
            created_at,
            status,
            from_number,
            to_number,
            conversation:sms_conversations!inner(
              campaign_id,
              contact_name
            )
          `)
          .in("conversation.campaign_id", campaignIds)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (smsData) {
          smsData.forEach((msg: any) => {
            allActivities.push({
              id: `sms-${msg.id}`,
              type: "sms",
              direction: msg.direction === "inbound" ? "inbound" : "outbound",
              content: msg.body || "",
              candidateName: msg.conversation?.contact_name || null,
              phone: msg.direction === "inbound" ? msg.from_number : msg.to_number,
              createdAt: msg.created_at,
              status: msg.status,
            });
          });
        }
      }

      // Fetch AI call logs
      const { data: callData } = await supabase
        .from("ai_call_logs")
        .select("*")
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
            phone: call.phone_number,
            createdAt: call.created_at || "",
            status: call.status,
            duration: call.duration_seconds || undefined,
          });
        });
      }

      // Sort all activities by date
      allActivities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(allActivities.slice(0, limit));
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (activity: ActivityItem) => {
    switch (activity.type) {
      case "sms":
        return MessageSquare;
      case "call":
        return Phone;
      case "email":
        return Mail;
      default:
        return MessageSquare;
    }
  };

  const getActivityColor = (activity: ActivityItem) => {
    switch (activity.type) {
      case "sms":
        return "text-blue-400";
      case "call":
        return "text-green-400";
      case "email":
        return "text-purple-400";
      default:
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No activity yet</p>
        <p className="text-sm">Activity will appear here when outreach begins</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 pr-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity);
          const iconColor = getActivityColor(activity);

          return (
            <div
              key={activity.id}
              className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors"
            >
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
                "bg-muted"
              )}>
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">
                    {activity.candidateName || activity.phone || "Unknown"}
                  </span>
                  
                  {/* Direction badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      activity.direction === "inbound" 
                        ? "border-success/30 text-success" 
                        : "border-primary/30 text-primary"
                    )}
                  >
                    {activity.direction === "inbound" ? (
                      <ArrowDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowUp className="h-3 w-3 mr-1" />
                    )}
                    {activity.direction}
                  </Badge>

                  {/* Type badge */}
                  <Badge variant="secondary" className="text-xs capitalize">
                    {activity.type}
                  </Badge>

                  {/* Duration for calls */}
                  {activity.duration && (
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(activity.duration / 60)}:{(activity.duration % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                </div>

                {/* Message content */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {activity.content}
                </p>

                {/* Timestamp */}
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span title={format(new Date(activity.createdAt), "PPpp")}>
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default JobActivityFeed;
