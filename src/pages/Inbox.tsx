import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Inbox as InboxIcon } from "lucide-react";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { NewMessageModal } from "@/components/inbox/NewMessageModal";

export type ChannelFilter = "all" | "sms" | "calls" | "ai_calls";

export interface ConversationItem {
  id: string;
  channel: "sms" | "call";
  candidateId: string | null;
  candidateName: string;
  candidatePhone: string | null;
  preview: string;
  timestamp: string;
  unreadCount: number;
}

const InboxPage = () => {
  const [activeTab, setActiveTab] = useState<ChannelFilter>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch SMS conversations with candidate data
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
          candidates!sms_conversations_candidate_id_fkey (
            first_name,
            last_name
          )
        `)
        .order("last_message_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch AI call logs
  const { data: aiCallLogs = [], isLoading: callsLoading } = useQuery({
    queryKey: ["ai-call-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_call_logs")
        .select("id, candidate_id, candidate_name, phone_number, call_result, created_at, status")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Transform data into unified conversation items
  const conversations: ConversationItem[] = [
    // SMS conversations
    ...smsConversations.map((conv: any) => ({
      id: conv.id,
      channel: "sms" as const,
      candidateId: conv.candidate_id,
      candidateName: conv.candidates 
        ? `${conv.candidates.first_name || ""} ${conv.candidates.last_name || ""}`.trim() || "Unknown"
        : "Unknown",
      candidatePhone: conv.candidate_phone,
      preview: conv.last_message_preview || "No messages",
      timestamp: conv.last_message_at,
      unreadCount: conv.unread_count || 0,
    })),
    // AI Call logs
    ...aiCallLogs.map((call: any) => ({
      id: call.id,
      channel: "call" as const,
      candidateId: call.candidate_id,
      candidateName: call.candidate_name || "Unknown",
      candidatePhone: call.phone_number,
      preview: call.call_result || call.status || "Call",
      timestamp: call.created_at,
      unreadCount: 0,
    })),
  ];

  // Filter by tab and search
  const filteredConversations = conversations
    .filter((conv) => {
      if (activeTab === "sms") return conv.channel === "sms";
      if (activeTab === "calls" || activeTab === "ai_calls") return conv.channel === "call";
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
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate total unread
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

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
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="calls">Calls</TabsTrigger>
              <TabsTrigger value="ai_calls">AI Calls</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Conversation list */}
          <div className="w-full md:w-[350px] flex-shrink-0 border-r border-border bg-card overflow-hidden flex flex-col">
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

export default InboxPage;
