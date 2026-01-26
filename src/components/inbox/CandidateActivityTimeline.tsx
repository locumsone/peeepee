import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Calendar, 
  Star, 
  PhoneIncoming, 
  PhoneMissed,
  Loader2,
  Briefcase
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineEvent {
  id: string;
  type: "sms_sent" | "sms_received" | "call_completed" | "call_missed" | "email_sent" | "email_opened" | "interested";
  title: string;
  description?: string;
  timestamp: string;
  channel: "sms" | "call" | "email";
  metadata?: Record<string, any>;
  jobTitle?: string;
  campaignName?: string;
}

interface CandidateActivityTimelineProps {
  candidateId: string | null;
  candidatePhone: string | null;
  className?: string;
}

export const CandidateActivityTimeline = ({ 
  candidateId, 
  candidatePhone,
  className 
}: CandidateActivityTimelineProps) => {
  // Fetch SMS messages for this candidate/phone
  const { data: smsEvents = [], isLoading: smsLoading } = useQuery({
    queryKey: ["timeline-sms", candidateId, candidatePhone],
    queryFn: async () => {
      if (!candidatePhone) return [];
      
      const { data, error } = await supabase
        .from("sms_messages")
        .select(`
          id,
          direction,
          body,
          created_at,
          sms_conversations!inner (
            campaign_id,
            campaigns (
              name,
              job_id,
              jobs (
                job_name
              )
            )
          )
        `)
        .eq("sms_conversations.candidate_phone", candidatePhone)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("SMS timeline error:", error);
        return [];
      }
      
      return (data || []).map((msg: any): TimelineEvent => ({
        id: msg.id,
        type: msg.direction === "inbound" ? "sms_received" : "sms_sent",
        title: msg.direction === "inbound" ? "SMS Received" : "SMS Sent",
        description: msg.body?.substring(0, 100) + (msg.body?.length > 100 ? "..." : ""),
        timestamp: msg.created_at,
        channel: "sms" as const,
        jobTitle: msg.sms_conversations?.campaigns?.jobs?.job_name,
        campaignName: msg.sms_conversations?.campaigns?.name,
      }));
    },
    enabled: !!candidatePhone,
  });

  // Fetch call logs for this candidate/phone
  const { data: callEvents = [], isLoading: callsLoading } = useQuery({
    queryKey: ["timeline-calls", candidateId, candidatePhone],
    queryFn: async () => {
      if (!candidatePhone) return [];
      
      // Clean phone for matching (remove non-digits)
      const cleanPhone = candidatePhone.replace(/\D/g, "");
      
      const { data, error } = await supabase
        .from("ai_call_logs")
        .select("id, candidate_name, phone_number, call_result, status, duration_seconds, created_at, job_id")
        .or(`phone_number.ilike.%${cleanPhone}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Calls timeline error:", error);
        return [];
      }
      
      return (data || []).map((call: any): TimelineEvent => ({
        id: call.id,
        type: call.status === "completed" || call.status === "ended" ? "call_completed" : "call_missed",
        title: getCallTitle(call.call_result, call.status),
        description: call.duration_seconds 
          ? `Duration: ${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, "0")}`
          : undefined,
        timestamp: call.created_at,
        channel: "call",
        metadata: { call_result: call.call_result },
      }));
    },
    enabled: !!candidatePhone,
  });

  // Fetch activity log entries
  const { data: activityEvents = [], isLoading: activityLoading } = useQuery({
    queryKey: ["timeline-activity", candidateId],
    queryFn: async () => {
      if (!candidateId) return [];
      
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Activity timeline error:", error);
        return [];
      }
      
      return (data || []).map((activity: any): TimelineEvent => ({
        id: activity.id,
        type: mapActivityType(activity.action_type),
        title: activity.action_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        description: activity.metadata?.summary || undefined,
        timestamp: activity.created_at,
        channel: (activity.channel as TimelineEvent["channel"]) || "email",
      }));
    },
    enabled: !!candidateId,
  });

  // Combine and sort all events
  const allEvents = [...smsEvents, ...callEvents, ...activityEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);

  const isLoading = smsLoading || callsLoading || activityLoading;

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case "sms_sent":
        return <MessageSquare className="h-3.5 w-3.5 text-accent" />;
      case "sms_received":
        return <MessageSquare className="h-3.5 w-3.5 text-success" />;
      case "call_completed":
        return <Phone className="h-3.5 w-3.5 text-success" />;
      case "call_missed":
        return <PhoneMissed className="h-3.5 w-3.5 text-warning" />;
      case "email_sent":
        return <Mail className="h-3.5 w-3.5 text-accent" />;
      case "email_opened":
        return <Mail className="h-3.5 w-3.5 text-success" />;
      case "interested":
        return <Star className="h-3.5 w-3.5 text-warning" />;
      default:
        return <Calendar className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No activity history yet
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[300px]", className)}>
      <div className="space-y-2 pr-2">
        {allEvents.map((event) => (
          <div 
            key={event.id} 
            className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              {getEventIcon(event)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{event.title}</span>
                {event.jobTitle && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                    <Briefcase className="h-2 w-2 mr-0.5" />
                    {event.jobTitle}
                  </Badge>
                )}
              </div>
              {event.description && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {event.description}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

function getCallTitle(result: string | null, status: string | null): string {
  if (result) {
    switch (result.toLowerCase()) {
      case "interested": return "Call - Interested";
      case "callback_requested": return "Call - Callback Requested";
      case "not_interested": return "Call - Not Interested";
      case "voicemail": return "Voicemail Left";
      case "no_answer": return "Call - No Answer";
      default: return `Call - ${result}`;
    }
  }
  if (status === "completed" || status === "ended") return "Call Completed";
  if (status === "no_answer") return "Call - No Answer";
  return "Call Attempted";
}

function mapActivityType(actionType: string): TimelineEvent["type"] {
  switch (actionType?.toLowerCase()) {
    case "sms_sent": return "sms_sent";
    case "sms_received": 
    case "sms_reply": return "sms_received";
    case "call_completed": return "call_completed";
    case "call_missed":
    case "call_failed": return "call_missed";
    case "email_sent": return "email_sent";
    case "email_opened": return "email_opened";
    case "interested":
    case "interest_detected": return "interested";
    default: return "email_sent";
  }
}
