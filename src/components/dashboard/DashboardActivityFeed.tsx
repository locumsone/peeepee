import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Phone, Mail, ThumbsUp, Clock, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface ActivityItem {
  id: string;
  source: "sms" | "call" | "email";
  action_type: string;
  preview: string | null;
  related_phone: string | null;
  candidate_name: string | null;
  created_at: string;
}

export function DashboardActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      // Fetch SMS messages
      const { data: smsData } = await supabase
        .from("sms_messages")
        .select("id, created_at, direction, body, to_number, from_number")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch AI call logs
      const { data: callData } = await supabase
        .from("ai_call_logs")
        .select("id, created_at, call_result, call_summary, phone_number, candidate_name")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch campaign events (email opens, clicks, replies)
      const { data: eventData } = await supabase
        .from("campaign_events")
        .select("id, created_at, event_type, metadata")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      // Transform and combine
      const smsActivities: ActivityItem[] = (smsData || []).map(sms => ({
        id: sms.id,
        source: "sms" as const,
        action_type: sms.direction === "inbound" ? "sms_reply" : "sms_sent",
        preview: sms.body?.slice(0, 80) || null,
        related_phone: sms.direction === "inbound" ? sms.from_number : sms.to_number,
        candidate_name: null,
        created_at: sms.created_at,
      }));

      const callActivities: ActivityItem[] = (callData || []).map(call => ({
        id: call.id,
        source: "call" as const,
        action_type: call.call_result === "interested" ? "call_interested" : "call_completed",
        preview: call.call_summary?.slice(0, 80) || null,
        related_phone: call.phone_number,
        candidate_name: call.candidate_name,
        created_at: call.created_at,
      }));

      const emailActivities: ActivityItem[] = (eventData || []).map(event => ({
        id: event.id,
        source: "email" as const,
        action_type: event.event_type,
        preview: null,
        related_phone: null,
        candidate_name: (event.metadata as Record<string, unknown>)?.email as string || null,
        created_at: event.created_at,
      }));

      // Combine and sort by date
      const combined = [...smsActivities, ...callActivities, ...emailActivities]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);

      setActivities(combined);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (item: ActivityItem) => {
    switch (item.source) {
      case "sms":
        return item.action_type === "sms_reply" 
          ? <MessageSquare className="h-4 w-4 text-blue-500" />
          : <Send className="h-4 w-4 text-muted-foreground" />;
      case "call":
        return item.action_type === "call_interested"
          ? <ThumbsUp className="h-4 w-4 text-emerald-500" />
          : <Phone className="h-4 w-4 text-violet-500" />;
      case "email":
        return <Mail className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityLabel = (item: ActivityItem) => {
    switch (item.action_type) {
      case "sms_reply":
        return "Received SMS reply";
      case "sms_sent":
        return "Sent SMS";
      case "call_interested":
        return "Interested call";
      case "call_completed":
        return "Call completed";
      case "email_opened":
        return "Email opened";
      case "email_clicked":
        return "Email link clicked";
      case "email_replied":
        return "Email reply received";
      default:
        return item.action_type;
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No recent activity</p>
        <p className="text-xs mt-1">Start a campaign to see activity here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="space-y-3">
        {activities.map((item) => (
          <div
            key={`${item.source}-${item.id}`}
            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="mt-0.5">
              {getActivityIcon(item)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {getActivityLabel(item)}
                </p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
              {(item.candidate_name || item.related_phone) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.candidate_name || formatPhone(item.related_phone)}
                </p>
              )}
              {item.preview && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  "{item.preview}..."
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
