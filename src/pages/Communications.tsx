import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Inbox as InboxIcon, Flame, MessageSquare, Phone, Star, Clock, Mail, Zap } from "lucide-react";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { NewMessageModal } from "@/components/inbox/NewMessageModal";
import { CampaignFilter } from "@/components/inbox/CampaignFilter";
import { calculatePriorityLevel, type PriorityLevel } from "@/components/inbox/PriorityBadge";

export type ChannelFilter = "all" | "urgent" | "hot" | "sms" | "calls" | "reminders";

export interface ConversationItem {
  id: string;
  channel: "sms" | "call";
  candidateId: string | null;
  candidateName: string;
  candidatePhone: string | null;
  candidateEmail?: string | null;
  contactName?: string | null;
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
  reminderAt?: string | null;
  reminderNote?: string | null;
  snoozedUntil?: string | null;
}

const Communications = () => {
  const [activeTab, setActiveTab] = useState<ChannelFilter>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch SMS conversations
  const { data: smsConversations = [], isLoading: smsLoading, refetch: refetchConversations } = useQuery({
    queryKey: ["sms-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_conversations")
        .select(`
          id,
          candidate_id,
          candidate_phone,
          contact_name,
          last_message_at,
          last_message_preview,
          unread_count,
          campaign_id,
          interest_detected,
          candidate_replied,
          reminder_at,
          reminder_note,
          snoozed_until,
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
    refetchInterval: 10000,
  });

  // Real-time subscription for conversation updates
  useEffect(() => {
    const channel = supabase
      .channel("sms-conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_conversations",
        },
        () => {
          console.log("Conversation update received via realtime");
          refetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_messages",
        },
        () => {
          console.log("New message received via realtime - refreshing conversations");
          refetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchConversations]);

  // Fetch AI call logs
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
    if (duration) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      return `Call ${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return "Call";
  };

  // Transform data into unified conversation items with priority
  const conversations: ConversationItem[] = [
    ...smsConversations.map((conv: any) => {
      const candidate = conv.candidates;
      const candidateName = candidate 
        ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
        : null;
      
      // Use contact_name if no candidate, fallback to phone
      const displayName = candidateName && candidateName !== "" 
        ? candidateName 
        : conv.contact_name || conv.candidate_phone || "Unknown";
      
      const { level, score } = calculatePriorityLevel({
        unreadCount: conv.unread_count || 0,
        repliedRecently: conv.candidate_replied,
        sentiment: conv.interest_detected ? "interested" : undefined,
      });

      return {
        id: conv.id,
        channel: "sms" as const,
        candidateId: conv.candidate_id,
        candidateName: displayName,
        candidatePhone: conv.candidate_phone,
        candidateEmail: candidate?.email || null,
        contactName: conv.contact_name,
        preview: conv.last_message_preview || "No messages",
        timestamp: conv.last_message_at,
        unreadCount: conv.unread_count || 0,
        campaignId: conv.campaign_id,
        isHot: level === "urgent" || level === "hot",
        priorityLevel: level,
        priorityScore: score,
        reminderAt: conv.reminder_at,
        reminderNote: conv.reminder_note,
        snoozedUntil: conv.snoozed_until,
      };
    }),
    ...aiCallLogs
      .filter((call: any) => {
        // Filter out incomplete test data
        if (call.status === "in_progress" && !call.candidate_name && !call.candidate_id) {
          return false;
        }
        return true;
      })
      .map((call: any) => {
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
      // Handle snoozed - hide from main views if snoozed until future
      if (conv.snoozedUntil && new Date(conv.snoozedUntil) > new Date()) {
        if (activeTab !== "reminders") return false;
      }
      
      if (activeTab === "urgent") return conv.priorityLevel === "urgent";
      if (activeTab === "hot") return conv.priorityLevel === "hot" || conv.priorityLevel === "urgent";
      if (activeTab === "sms") return conv.channel === "sms";
      if (activeTab === "calls") return conv.channel === "call";
      if (activeTab === "reminders") return !!conv.reminderAt || !!conv.snoozedUntil;
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
      // For reminders tab, sort by reminder time
      if (activeTab === "reminders") {
        const aTime = a.reminderAt || a.snoozedUntil || "";
        const bTime = b.reminderAt || b.snoozedUntil || "";
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      }
      // Default: priority then recency
      if ((b.priorityScore || 0) !== (a.priorityScore || 0)) {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // Calculate counts
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const urgentCount = conversations.filter((c) => c.priorityLevel === "urgent").length;
  const remindersCount = conversations.filter((c) => c.reminderAt || c.snoozedUntil).length;

  // Keyboard navigation
  const handleKeyNavigation = useCallback((e: KeyboardEvent) => {
    // Don't handle if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (!((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
        return;
      }
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(filteredConversations.length - 1, prev + 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredConversations[selectedIndex]) {
          setSelectedConversation(filteredConversations[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setSelectedConversation(null);
        break;
      case "n":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setIsNewMessageOpen(true);
        }
        break;
    }
  }, [filteredConversations, selectedIndex]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNavigation);
    return () => window.removeEventListener("keydown", handleKeyNavigation);
  }, [handleKeyNavigation]);

  const handleSelectConversation = (conversation: ConversationItem) => {
    setSelectedConversation(conversation);
    const index = filteredConversations.findIndex((c) => c.id === conversation.id);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  };

  const isLoading = smsLoading || callsLoading;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Compact header */}
        <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title and campaign filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <InboxIcon className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-lg font-display font-bold text-foreground hidden sm:block">
                  Inbox
                </h1>
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="rounded-full px-2 text-xs">
                    {totalUnread}
                  </Badge>
                )}
              </div>
              
              <div className="hidden md:block">
                <CampaignFilter
                  selectedCampaignId={selectedCampaignId}
                  onSelectCampaign={setSelectedCampaignId}
                />
              </div>
            </div>

            {/* Center: Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelFilter)}>
              <TabsList className="bg-muted h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-7">
                  All
                </TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs px-3 h-7 gap-1">
                  <Flame className="h-3 w-3 text-red-500" />
                  <span className="hidden sm:inline">Urgent</span>
                  {urgentCount > 0 && (
                    <span className="ml-1 text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5">
                      {urgentCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="hot" className="text-xs px-3 h-7 gap-1">
                  <Star className="h-3 w-3 text-orange-500" />
                  <span className="hidden sm:inline">Hot</span>
                </TabsTrigger>
                <TabsTrigger value="sms" className="text-xs px-3 h-7 gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="hidden sm:inline">SMS</span>
                </TabsTrigger>
                <TabsTrigger value="calls" className="text-xs px-3 h-7 gap-1">
                  <Phone className="h-3 w-3" />
                  <span className="hidden sm:inline">Calls</span>
                </TabsTrigger>
                <TabsTrigger value="reminders" className="text-xs px-3 h-7 gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">Reminders</span>
                  {remindersCount > 0 && (
                    <span className="ml-1 text-[10px] bg-muted-foreground/20 text-muted-foreground rounded-full px-1.5">
                      {remindersCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs px-3 h-7 gap-1" disabled>
                  <Mail className="h-3 w-3" />
                  <span className="hidden sm:inline">Email</span>
                  <Badge variant="outline" className="text-[8px] px-1 ml-1">Soon</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right: New message button */}
            <Button
              onClick={() => setIsNewMessageOpen(true)}
              size="sm"
              className="gradient-primary h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Conversation list */}
          <div className="w-full sm:w-[320px] md:w-[360px] flex-shrink-0 border-r border-border overflow-hidden">
            <ConversationList
              conversations={filteredConversations}
              selectedId={selectedConversation?.id || null}
              onSelect={handleSelectConversation}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isLoading={isLoading}
            />
          </div>

          {/* Right: Conversation detail or empty state */}
          <div className="hidden sm:flex flex-1 overflow-hidden">
            {filteredConversations.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 bg-background w-full">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">
                  Inbox Zero!
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  All caught up. Start a new conversation or check back later for replies.
                </p>
                <Button
                  onClick={() => setIsNewMessageOpen(true)}
                  className="gradient-primary"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Message
                </Button>
              </div>
            ) : (
              <ConversationDetail conversation={selectedConversation} />
            )}
          </div>
        </div>

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
