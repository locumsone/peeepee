import { Search, MessageSquare, Phone, Loader2, Flame, Star, Snowflake, Clock, Bot, PhoneIncoming, PhoneOutgoing, MailOpen, Mail, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ConversationItem } from "@/pages/Communications";
import type { PriorityLevel } from "./PriorityBadge";

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (conversation: ConversationItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

const priorityBorderColors: Record<PriorityLevel, string> = {
  urgent: "border-l-4 border-l-red-500",
  hot: "border-l-4 border-l-orange-500",
  warm: "border-l-4 border-l-yellow-500",
  cold: "border-l-4 border-l-slate-500",
};

const priorityIcons: Record<PriorityLevel, React.ReactNode> = {
  urgent: <Flame className="h-3.5 w-3.5 text-red-500" />,
  hot: <Star className="h-3.5 w-3.5 text-orange-500" />,
  warm: null,
  cold: <Snowflake className="h-3.5 w-3.5 text-slate-400" />,
};

export const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  isLoading,
}: ConversationListProps) => {
  const queryClient = useQueryClient();

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return "";
    }
  };

  // Action handlers for context menu
  const handleMarkAsRead = async (conversationId: string) => {
    try {
      await supabase
        .from("sms_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
      toast.success("Marked as read");
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAsUnread = async (conversationId: string) => {
    try {
      await supabase
        .from("sms_conversations")
        .update({ unread_count: 1 })
        .eq("id", conversationId);
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
      toast.success("Marked as unread");
    } catch {
      toast.error("Failed to mark as unread");
    }
  };

  const handleClearPriority = async (conversationId: string) => {
    try {
      await supabase
        .from("sms_conversations")
        .update({ 
          interest_detected: false, 
          candidate_replied: false,
          unread_count: 0 
        })
        .eq("id", conversationId);
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
      toast.success("Priority cleared");
    } catch {
      toast.error("Failed to clear priority");
    }
  };

  const truncatePreview = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const getReminderDisplay = (reminderAt: string | null, snoozedUntil: string | null) => {
    const reminderDate = reminderAt ? new Date(reminderAt) : snoozedUntil ? new Date(snoozedUntil) : null;
    if (!reminderDate) return null;
    
    const isOverdue = isPast(reminderDate);
    return {
      text: format(reminderDate, "MMM d, h:mm a"),
      isOverdue,
    };
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 bg-muted/50 border-0 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => {
              const priority = conversation.priorityLevel || "cold";
              const isSelected = selectedId === conversation.id;
              const reminder = getReminderDisplay(conversation.reminderAt || null, conversation.snoozedUntil || null);
              const isSMS = conversation.channel === "sms";

              return (
                <ContextMenu key={conversation.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => onSelect(conversation)}
                      className={cn(
                        "w-full px-4 py-3 flex items-start gap-3 text-left transition-all",
                        "border-b border-border/50",
                        priorityBorderColors[priority],
                        isSelected 
                          ? "bg-primary/10" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Avatar / Channel icon with call type indicator */}
                      <div className="relative">
                        <div
                          className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                            conversation.channel === "sms"
                              ? "bg-accent/20 text-accent"
                              : conversation.callType === "ai" || conversation.callType === "cold_call"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : conversation.callType === "inbound"
                                  ? "bg-success/20 text-success"
                                  : "bg-primary/20 text-primary"
                          )}
                        >
                          {conversation.channel === "sms" ? (
                            <MessageSquare className="h-4 w-4" />
                          ) : conversation.callType === "ai" || conversation.callType === "cold_call" ? (
                            <Bot className="h-4 w-4" />
                          ) : conversation.callType === "inbound" ? (
                            <PhoneIncoming className="h-4 w-4" />
                          ) : (
                            <PhoneOutgoing className="h-4 w-4" />
                          )}
                        </div>
                        {/* Call type badge */}
                        {conversation.channel === "call" && conversation.callType && (
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-card",
                            conversation.callType === "ai" || conversation.callType === "cold_call"
                              ? "bg-cyan-500 text-white"
                              : conversation.callType === "inbound"
                                ? "bg-success text-success-foreground"
                                : "bg-primary text-primary-foreground"
                          )}>
                            {conversation.callType === "ai" || conversation.callType === "cold_call" ? "AI" : 
                             conversation.callType === "inbound" ? "IN" : "OUT"}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-foreground truncate text-sm">
                              {conversation.candidateName}
                            </span>
                            {priorityIcons[priority]}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatTimeAgo(conversation.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {truncatePreview(conversation.preview)}
                        </p>

                        {/* Phone number, duration, and reminder */}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {formatPhoneNumber(conversation.candidatePhone)}
                          </span>
                          <div className="flex items-center gap-2">
                            {conversation.channel === "call" && conversation.duration && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {Math.floor(conversation.duration / 60)}:{(conversation.duration % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                            {reminder && (
                              <span className={cn(
                                "text-[10px] flex items-center gap-0.5",
                                reminder.isOverdue ? "text-destructive" : "text-muted-foreground"
                              )}>
                                <Clock className="h-3 w-3" />
                                {format(new Date(conversation.reminderAt || conversation.snoozedUntil || ""), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {conversation.unreadCount > 0 && (
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary-foreground">
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </span>
                        </div>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  
                  {/* Right-click context menu - only for SMS conversations */}
                  {isSMS && (
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => handleMarkAsRead(conversation.id)}>
                        <MailOpen className="h-4 w-4 mr-2" />
                        Mark as Read
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleMarkAsUnread(conversation.id)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Mark as Unread
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleClearPriority(conversation.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Clear Priority
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
