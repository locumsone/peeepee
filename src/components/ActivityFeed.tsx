import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";

interface ActivityFilter {
  campaign_id?: string;
  candidate_id?: string;
  limit?: number;
}

interface ActivityItem {
  id: string;
  action_type: string;
  user_name: string;
  created_at: string | null;
  metadata: unknown;
  channel: string | null;
}

interface ActivityFeedProps {
  filter?: ActivityFilter;
  showCandidate?: boolean;
  className?: string;
}

const getActivityIcon = (type: string): string => {
  switch (type) {
    case "email_sent":
      return "📧";
    case "email_opened":
      return "👁️";
    case "sms_sent":
      return "💬";
    case "sms_reply":
      return "💬";
    case "call_completed":
      return "📞";
    case "interested_signal":
      return "⭐";
    case "callback_scheduled":
      return "📅";
    default:
      return "📋";
  }
};

const getActivityStyle = (type: string): string => {
  switch (type) {
    case "sms_reply":
      return "bg-success/10 border-success/20";
    case "interested_signal":
      return "bg-warning/10 border-warning/20";
    case "email_opened":
      return "bg-info/10 border-info/20";
    case "call_completed":
      return "bg-primary/10 border-primary/20";
    default:
      return "bg-muted/50 border-border";
  }
};

const getActivityDescription = (activity: ActivityItem, showCandidate: boolean): string => {
  const metadata = activity.metadata as Record<string, unknown> | null;
  const candidateName = (metadata?.candidate_name as string) || "Unknown";
  
  let description = "";
  
  switch (activity.action_type) {
    case "email_sent":
      description = "Email sent";
      break;
    case "email_opened":
      description = "Email opened";
      break;
    case "sms_sent":
      description = "SMS sent";
      break;
    case "sms_reply":
      description = "SMS reply received";
      break;
    case "call_completed":
      description = "Call completed";
      break;
    case "interested_signal":
      description = "Showed interest";
      break;
    case "callback_scheduled":
      description = "Callback scheduled";
      break;
    default:
      description = activity.action_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }
  
  if (showCandidate && candidateName !== "Unknown") {
    description = `${candidateName} - ${description}`;
  }
  
  return description;
};

export const ActivityFeed = ({ filter = {}, showCandidate = true, className }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [filter.campaign_id, filter.candidate_id, filter.limit]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filter.limit || 20);

      if (filter.campaign_id) {
        query = query.eq("campaign_id", filter.campaign_id);
      }

      if (filter.candidate_id) {
        query = query.eq("entity_id", filter.candidate_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No recent activity
      </div>
    );
  }

  return (
    <ScrollArea className={className || "h-[400px]"}>
      <div className="space-y-3 pr-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/30 ${getActivityStyle(activity.action_type)}`}
          >
            <div className="text-xl shrink-0 mt-0.5">
              {getActivityIcon(activity.action_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {getActivityDescription(activity, showCandidate)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activity.created_at
                  ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                  : "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default ActivityFeed;
