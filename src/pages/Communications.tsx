import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Inbox as InboxIcon, Flame, MessageSquare, Phone, Star, Snowflake } from "lucide-react";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { NewMessageModal } from "@/components/inbox/NewMessageModal";
import { CampaignNavigator } from "@/components/inbox/CampaignNavigator";
import { CandidateContextSidebar } from "@/components/inbox/CandidateContextSidebar";
import { calculatePriorityLevel, type PriorityLevel } from "@/components/inbox/PriorityBadge";

export type ChannelFilter = "all" | "urgent" | "hot" | "sms" | "calls";

export interface ConversationItem {
  id: string;
  channel: "sms" | "call";
  candidateId: string | null;
  candidateName: string;
  candidatePhone: string | null;
  candidateEmail?: string | null;
  preview: string;
  timestamp: string;
  unreadCount: number;
  duration?: number;
  outcome?: string;
  campaignId?: string | null;
  isHot?: boolean;
  interestLevel?: string | null;
  priorityLevel?: PriorityLevel;
  priorityScore?: number;
}

const Communications = () => {
  const [activeTab, setActiveTab] = useState<ChannelFilter>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Fetch SMS conversations with candidate data via proper join
  const { data: smsConversations = [], isLoading: smsLoading } = useQuery({
    queryKey: ["sms-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_conversations")
        .select(`
          id,
          candidate_id,
          candidate_phone,
          last_message_at,
          last_message_preview,
          unread_count,
          campaign_id,
          interest_detected,
          candidate_replied,
          candidates (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order("last_message_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch AI call logs with candidate data
  const { data: aiCallLogs = [], isLoading: callsLoading } = useQuery({
    queryKey: ["ai-call-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_call_logs")
        .select(`
          id,
          candidate_id,
          candidate_name,
          phone_number,
          call_result,
          created_at,
          status,
          duration_seconds,
          call_type
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Format duration as M:SS
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get outcome display text
  const getOutcomePreview = (result: string | null, status: string | null, duration: number | null) => {
    if (result) {
      switch (result.toLowerCase()) {
        case "interested": return "Interested";
        case "callback_requested": return "Callback Requested";
        case "not_interested": return "Not Interested";
        case "voicemail": return "Voicemail Left";
        case "no_answer": return "No Answer";
        default: return result;
      }
    }
    if (status) {
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
    }
    return `Call ${formatDuration(duration)}`;
  };

  // Check if conversation is "hot" (recent activity, interested, or unread)
  const isConversationHot = (conv: any, channel: "sms" | "call") => {
    const now = new Date();
    const timestamp = new Date(conv.last_message_at || conv.created_at);
    const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (channel === "sms") {
      return (
        (conv.unread_count || 0) > 0 ||
        conv.interest_detected ||
        hoursDiff <= 48
      );
    }
    
    // For calls
    return (
      conv.call_result === "interested" ||
      conv.call_result === "callback_requested" ||
      hoursDiff <= 48
    );
  };

  // Transform data into unified conversation items with priority
  const conversations: ConversationItem[] = [
    // SMS conversations with proper candidate name
    ...smsConversations.map((conv: any) => {
      const candidate = conv.candidates;
      const candidateName = candidate 
        ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
        : null;
      
      const { level, score } = calculatePriorityLevel({
        unreadCount: conv.unread_count || 0,
        repliedRecently: conv.candidate_replied,
        sentiment: conv.interest_detected ? "interested" : undefined,
      });

      return {
        id: conv.id,
        channel: "sms" as const,
        candidateId: conv.candidate_id,
        candidateName: candidateName || conv.candidate_phone || "Unknown",
        candidatePhone: conv.candidate_phone,
        candidateEmail: candidate?.email || null,
        preview: conv.last_message_preview || "No messages",
        timestamp: conv.last_message_at,
        unreadCount: conv.unread_count || 0,
        campaignId: conv.campaign_id,
        isHot: level === "urgent" || level === "hot",
        priorityLevel: level,
        priorityScore: score,
      };
    }),
    // AI Call logs with proper candidate name and outcome
    ...aiCallLogs.map((call: any) => {
      const { level, score } = calculatePriorityLevel({
        sentiment: call.call_result === "interested" ? "interested" : 
                  call.call_result === "not_interested" ? "not_interested" : undefined,
        callbackRequested: call.call_result === "callback_requested",
      });

      return {
        id: call.id,
        channel: "call" as const,
        candidateId: call.candidate_id,
        candidateName: call.candidate_name || "Unknown",
        candidatePhone: call.phone_number,
        preview: getOutcomePreview(call.call_result, call.status, call.duration_seconds),
        timestamp: call.created_at,
        unreadCount: 0,
        duration: call.duration_seconds,
        outcome: call.call_result,
        isHot: level === "urgent" || level === "hot",
        priorityLevel: level,
        priorityScore: score,
      };
    }),
  ];

  // Filter by campaign
  const campaignFiltered = conversations.filter((conv) => {
    if (selectedCampaignId === null) return true;
    if (selectedCampaignId === "unassigned") return !conv.campaignId;
    return conv.campaignId === selectedCampaignId;
  });

  // Filter by tab and search
  const filteredConversations = campaignFiltered
    .filter((conv) => {
      if (activeTab === "urgent") return conv.priorityLevel === "urgent";
      if (activeTab === "hot") return conv.priorityLevel === "hot" || conv.priorityLevel === "urgent";
      if (activeTab === "sms") return conv.channel === "sms";
      if (activeTab === "calls") return conv.channel === "call";
      return true;
    })
    .filter((conv) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        conv.candidateName.toLowerCase().includes(query) ||
        (conv.candidatePhone && conv.candidatePhone.includes(query))
      );
    })
    .sort((a, b) => {
      // Sort by priority score first, then by timestamp
      if ((b.priorityScore || 0) !== (a.priorityScore || 0)) {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // Calculate counts
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const urgentCount = conversations.filter((c) => c.priorityLevel === "urgent").length;
  const hotCount = conversations.filter((c) => c.priorityLevel === "hot" || c.priorityLevel === "urgent").length;

  const isLoading = smsLoading || callsLoading;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <InboxIcon className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Communication Hub
              </h1>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="rounded-full px-2.5">
                  {totalUnread}
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelFilter)}>
            <TabsList className="bg-muted">
              <TabsTrigger value="all" className="gap-1.5">
                All
              </TabsTrigger>
              <TabsTrigger value="urgent" className="gap-1.5">
                <Flame className="h-3.5 w-3.5 text-red-500" />
                Urgent
                {urgentCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                    {urgentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="hot" className="gap-1.5">
                <Star className="h-3.5 w-3.5 text-orange-500" />
                Hot
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                SMS
              </TabsTrigger>
              <TabsTrigger value="calls" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Calls
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Three-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Campaign Navigator */}
          <div className="hidden lg:flex w-[250px] flex-shrink-0 overflow-hidden">
            <CampaignNavigator
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
            />
          </div>

          {/* Center - Conversation list */}
          <div className="w-full md:w-[400px] flex-shrink-0 border-r border-border bg-card overflow-hidden flex flex-col">
            <ConversationList
              conversations={filteredConversations}
              selectedId={selectedConversation?.id || null}
              onSelect={setSelectedConversation}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isLoading={isLoading}
            />
          </div>

          {/* Right panel - Conversation detail */}
          <div className="hidden md:flex flex-1 bg-background overflow-hidden">
            <ConversationDetail conversation={selectedConversation} />
          </div>

          {/* Candidate Context Sidebar */}
          <CandidateContextSidebar 
            conversation={selectedConversation}
            className="hidden xl:flex w-[280px] flex-shrink-0"
          />
        </div>

        {/* Floating action button */}
        <Button
          onClick={() => setIsNewMessageOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg gradient-primary hover:shadow-glow transition-all"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>

        {/* New Message Modal */}
        <NewMessageModal 
          open={isNewMessageOpen} 
          onOpenChange={setIsNewMessageOpen} 
        />
      </div>
    </Layout>
  );
};

export default Communications;
