import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Send, Loader2, Download, Calendar, PhoneCall, MessageCircle, User, Shield, MapPin, Check, CheckCheck, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { format, isToday, isYesterday, isSameDay, isPast } from "date-fns";
import { toast } from "sonner";
import type { ConversationItem } from "@/pages/Communications";
import { QuickReplyChips } from "./QuickReplyChips";
import { InlineAISuggestions } from "./InlineAISuggestions";
import { SnoozePopover } from "./SnoozePopover";

interface SMSMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  created_at: string;
}

interface CallLog {
  id: string;
  candidate_name: string | null;
  candidate_id: string | null;
  phone_number: string;
  from_number: string | null;
  call_type: string | null;
  status: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  started_at: string | null;
  campaign_id?: string | null;
  call_result: string | null;
  transcript_text: string | null;
  recording_url: string | null;
  call_summary: string | null;
}

// Call Detail View Component
const CallDetailView = ({ conversation }: { conversation: ConversationItem }) => {
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const queryClient = useQueryClient();

  const { data: callData, isLoading: callLoading } = useQuery({
    queryKey: ["call-detail", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_call_logs")
        .select("*")
        .eq("id", conversation.id)
        .single();
      if (error) throw error;
      return data as CallLog;
    },
    enabled: !!conversation.id,
  });

  useEffect(() => {
    if (callData?.call_summary) {
      setNotes(callData.call_summary);
    }
  }, [callData?.call_summary]);

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_call_logs")
        .update({ call_summary: notes })
        .eq("id", conversation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-detail", conversation.id] });
      toast.success("Notes saved");
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "ended":
        return <Badge className="bg-success/20 text-success border-0">Completed</Badge>;
      case "no_answer":
        return <Badge className="bg-warning/20 text-warning border-0">No Answer</Badge>;
      case "failed":
        return <Badge className="bg-destructive/20 text-destructive border-0">Failed</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  if (callLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Compact header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-success/20 text-success">
            <Phone className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {callData?.candidate_name || conversation.candidateName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {getStatusBadge(callData?.status)}
              <span className="text-xs text-muted-foreground font-mono">
                {formatDuration(callData?.duration_seconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card className="bg-muted/30 border-border">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Date</span>
                <p className="font-medium text-sm">
                  {callData?.created_at
                    ? format(new Date(callData.created_at), "MMM d, h:mm a")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Outcome</span>
                <p className="font-medium text-sm capitalize">
                  {callData?.call_result?.replace(/_/g, " ") || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {callData?.transcript_text && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Transcript</h3>
            <div className="bg-muted/30 rounded-lg p-3 max-h-[200px] overflow-y-auto text-sm">
              {callData.transcript_text}
            </div>
          </div>
        )}

        {callData?.recording_url && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Recording</h3>
            <audio controls className="w-full h-10">
              <source src={callData.recording_url} type="audio/mpeg" />
            </audio>
          </div>
        )}

        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Notes</h3>
          <Textarea
            placeholder="Add notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <Button
            onClick={() => saveNotesMutation.mutate()}
            disabled={saveNotesMutation.isPending}
            size="sm"
            className="mt-2"
          >
            Save Notes
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 border-t border-border bg-card p-3">
        <div className="flex gap-2">
          <Button className="flex-1 gradient-primary" size="sm">
            <PhoneCall className="h-4 w-4 mr-1" />
            Call Back
          </Button>
          <Button variant="outline" size="sm">
            <MessageCircle className="h-4 w-4 mr-1" />
            SMS
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <Label className="text-xs">Schedule Callback</Label>
                <Input
                  type="datetime-local"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button size="sm" className="w-full">Confirm</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

interface ConversationDetailProps {
  conversation: ConversationItem | null;
}

export const ConversationDetail = ({ conversation }: ConversationDetailProps) => {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ["sms-messages", conversation?.id],
    queryFn: async () => {
      if (!conversation || conversation.channel !== "sms") return [];
      const { data, error } = await supabase
        .from("sms_messages")
        .select("id, conversation_id, direction, body, status, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SMSMessage[];
    },
    enabled: !!conversation && conversation.channel === "sms",
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversation || conversation.channel !== "sms") return;

    const channel = supabase
      .channel(`sms-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          console.log("New message received via realtime");
          refetchMessages();
          queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, conversation?.channel, refetchMessages, queryClient]);

  // Auto-scroll and focus
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (textareaRef.current && conversation?.channel === "sms") {
      textareaRef.current.focus();
    }
  }, [messages, conversation?.id]);

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!conversation) return;
      await supabase
        .from("sms_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
    },
  });

  // Auto mark as read when opening
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0 && conversation.channel === "sms") {
      markAsReadMutation.mutate();
    }
  }, [conversation?.id]);

  // Send message
  const sendMessage = async () => {
    if (!messageText.trim() || !conversation?.candidatePhone) return;

    setIsSending(true);
    const optimisticMessage: SMSMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      direction: "outbound",
      body: messageText,
      status: "sending",
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData(
      ["sms-messages", conversation.id],
      (old: SMSMessage[] = []) => [...old, optimisticMessage]
    );

    try {
      const { error } = await supabase.functions.invoke("sms-campaign-send", {
        body: {
          to_phone: conversation.candidatePhone,
          custom_message: messageText,
          from_number: "+12185628671",
        },
      });
      if (error) throw error;
      toast.success("Message sent");
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["sms-messages", conversation.id] });
    } catch {
      queryClient.setQueryData(
        ["sms-messages", conversation.id],
        (old: SMSMessage[] = []) => old.filter((m) => m.id !== optimisticMessage.id)
      );
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAISuggestion = useCallback((text: string) => {
    setMessageText(text);
    textareaRef.current?.focus();
  }, []);

  const handleQuickReply = useCallback((text: string) => {
    setMessageText(text);
    textareaRef.current?.focus();
    toast.success("Quick reply inserted");
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Send on Cmd+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [messageText, conversation]);

  const lastInboundMessage = messages
    .filter((m) => m.direction === "inbound")
    .slice(-1)[0]?.body || null;

  const formatDateDivider = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d");
  };

  const getCharCountColor = () => {
    const len = messageText.length;
    if (len >= 160) return "text-destructive";
    if (len >= 140) return "text-warning";
    return "text-muted-foreground";
  };

  // Empty state
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 bg-background">
        <div className="p-4 rounded-full bg-muted mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Choose a conversation from the list to start replying
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to select
        </p>
      </div>
    );
  }

  // Call view
  if (conversation.channel === "call") {
    return <CallDetailView conversation={conversation} />;
  }

  // SMS conversation view
  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Compact header with inline context */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent/20 text-accent flex-shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              {conversation.candidateId ? (
                <Link
                  to={`/candidates/${conversation.candidateId}`}
                  className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                >
                  {conversation.candidateName}
                </Link>
              ) : (
                <span className="font-semibold text-foreground truncate block">{conversation.candidateName}</span>
              )}
              <span className="text-xs text-muted-foreground font-mono">{formatPhoneNumber(conversation.candidatePhone)}</span>
            </div>
          </div>

          {/* Inline actions */}
          <div className="flex items-center gap-2">
            {/* Reminder indicator */}
            {(conversation.reminderAt || conversation.snoozedUntil) && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] gap-1",
                  isPast(new Date(conversation.reminderAt || conversation.snoozedUntil || "")) 
                    ? "border-destructive text-destructive" 
                    : ""
                )}
              >
                <Clock className="h-3 w-3" />
                {format(new Date(conversation.reminderAt || conversation.snoozedUntil || ""), "MMM d")}
              </Badge>
            )}
            <SnoozePopover 
              onSnooze={async (date) => {
                try {
                  await supabase
                    .from("sms_conversations")
                    .update({ 
                      reminder_at: date.toISOString(),
                      snoozed_until: date.toISOString() 
                    })
                    .eq("id", conversation.id);
                  queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
                  toast.success(`Reminder set for ${format(date, "MMM d, h:mm a")}`);
                } catch {
                  toast.error("Failed to set reminder");
                }
              }}
              currentReminder={conversation.reminderAt ? new Date(conversation.reminderAt) : null}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <PhoneCall className="h-3 w-3 mr-1" />
              Call
            </Button>
          </div>
        </div>
      </div>


      {/* Message thread - takes most space */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const messageDate = new Date(message.created_at);
              const prevMessage = messages[index - 1];
              const showDateDivider =
                !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

              return (
                <div key={message.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full bg-muted text-[10px] text-muted-foreground">
                        {formatDateDivider(messageDate)}
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      message.direction === "outbound" ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-sm",
                        message.direction === "outbound"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {message.body}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {format(messageDate, "h:mm a")}
                      </span>
                      {message.direction === "outbound" && (
                        <span className="flex items-center">
                          {message.status === "sending" && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                          {message.status === "sent" && (
                            <Check className="h-3 w-3 text-muted-foreground" />
                          )}
                          {message.status === "delivered" && (
                            <CheckCheck className="h-3 w-3 text-success" />
                          )}
                          {message.status === "failed" && (
                            <X className="h-3 w-3 text-destructive" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply-first composer section */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        {/* AI Suggestions - inline above composer */}
        <InlineAISuggestions
          conversationId={conversation.id}
          candidateId={conversation.candidateId}
          campaignId={conversation.campaignId}
          lastInboundMessage={lastInboundMessage}
          onSelectSuggestion={handleAISuggestion}
          channel="sms"
        />

        {/* Quick Reply Chips */}
        <QuickReplyChips onSelect={handleQuickReply} />

        {/* Main composer */}
        <div className="p-4 pt-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Type your reply..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[100px] resize-none pr-20 text-sm bg-muted/30 border-border focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            
            {/* Character count and send button */}
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className={cn("text-[10px]", getCharCountColor())}>
                {messageText.length}/160
              </span>
              <Button
                onClick={sendMessage}
                disabled={!messageText.trim() || isSending}
                size="sm"
                className="h-8 px-3 gradient-primary"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Keyboard hint */}
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            <kbd className="px-1 py-0.5 bg-muted rounded">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to send
          </p>
        </div>
      </div>
    </div>
  );
};
