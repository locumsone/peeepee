import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, MoreVertical, Check, Send, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { toast } from "sonner";
import type { ConversationItem } from "@/pages/Communications";

interface ConversationDetailProps {
  conversation: ConversationItem | null;
}

interface SMSMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  created_at: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  template_text: string;
}

export const ConversationDetail = ({ conversation }: ConversationDetailProps) => {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages for SMS conversations
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
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
  });

  // Fetch SMS templates
  const { data: templates = [] } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("id, name, template_text")
        .eq("is_active", true)
        .limit(20);

      if (error) return [];
      return (data || []) as SMSTemplate[];
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark as read mutation
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
      toast.success("Marked as read");
    },
  });

  // Send SMS mutation
  const sendMessage = async () => {
    if (!messageText.trim() || !conversation?.candidatePhone) return;

    setIsSending(true);

    // Optimistically add message to UI
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
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/sms-campaign-send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTEyODYsImV4cCI6MjA4MTgyNzI4Nn0.yTePf_4bp6ZkZH_kI2YXlRN69SKGjVEKcdzX2bGW4OA`,
          },
          body: JSON.stringify({
            to_phone: conversation.candidatePhone,
            message: messageText,
            from_number: "+12185628671",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send SMS");
      }

      toast.success("Message sent");
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["sms-messages", conversation.id] });
    } catch (error) {
      // Remove optimistic message on error
      queryClient.setQueryData(
        ["sms-messages", conversation.id],
        (old: SMSMessage[] = []) => old.filter((m) => m.id !== optimisticMessage.id)
      );
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSelect = (template: SMSTemplate) => {
    setMessageText(template.template_text);
  };

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
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="p-4 rounded-full bg-muted mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Choose a conversation from the list to view messages and details
        </p>
      </div>
    );
  }

  // Call conversation placeholder
  if (conversation.channel === "call") {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-success/20 text-success">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{conversation.candidateName}</h2>
              <p className="text-sm text-muted-foreground">
                {conversation.candidatePhone || "No phone number"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <p className="text-muted-foreground">Call transcript view coming soon</p>
          </div>
        </div>
      </div>
    );
  }

  // SMS conversation view
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent/20 text-accent">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              {conversation.candidateId ? (
                <Link
                  to={`/candidates/${conversation.candidateId}`}
                  className="font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {conversation.candidateName}
                </Link>
              ) : (
                <h2 className="font-semibold text-foreground">{conversation.candidateName}</h2>
              )}
              <p className="text-sm text-muted-foreground">
                {conversation.candidatePhone || "No phone number"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation.unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAsReadMutation.mutate()}
                disabled={markAsReadMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Mark as Read
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Add note coming soon")}>
                  Add Note
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => toast.info("Block number coming soon")}
                >
                  Block Number
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: "60%" }}>
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const messageDate = new Date(message.created_at);
              const prevMessage = messages[index - 1];
              const showDateDivider =
                !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

              return (
                <div key={message.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                        {formatDateDivider(messageDate)}
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex flex-col max-w-[75%]",
                      message.direction === "outbound" ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl text-sm",
                        message.direction === "outbound"
                          ? "bg-[#8B5CF6] text-white rounded-br-md"
                          : "bg-[#374151] text-white rounded-bl-md"
                      )}
                    >
                      {message.body}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {format(messageDate, "h:mm a")}
                      {message.status === "sending" && " • Sending..."}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply composer */}
      <div className="flex-shrink-0 border-t border-border bg-card p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[80px] resize-none pr-16"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className={cn("text-xs", getCharCountColor())}>
                {messageText.length}/160
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {templates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" title="Insert template">
                    <FileText className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {template.template_text.slice(0, 50)}...
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              onClick={sendMessage}
              disabled={!messageText.trim() || isSending}
              className="gradient-primary"
              size="icon"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
