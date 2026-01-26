import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, MoreVertical, Check, Send, FileText, Loader2, Download, Calendar, PhoneCall, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { AIReplyPanel } from "./AIReplyPanel";

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
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [callbackDate, setCallbackDate] = useState("");
  const queryClient = useQueryClient();

  // Fetch call data
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

  // Fetch campaign name if campaign_id exists
  const { data: campaign } = useQuery({
    queryKey: ["campaign", callData?.campaign_id],
    queryFn: async () => {
      if (!callData?.campaign_id) return null;
      const { data, error } = await supabase
        .from("campaigns")
        .select("name")
        .eq("id", callData.campaign_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!callData?.campaign_id,
  });

  // Initialize notes when call data loads
  useEffect(() => {
    if (callData?.call_summary) {
      setNotes(callData.call_summary);
    }
  }, [callData?.call_summary]);

  // Save notes mutation
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
    onError: () => {
      toast.error("Failed to save notes");
    },
  });

  // Schedule callback
  const scheduleCallback = async () => {
    if (!callbackDate) {
      toast.error("Please select a date and time");
      return;
    }

    try {
      const { error } = await supabase.from("scheduled_callbacks").insert({
        candidate_id: callData?.candidate_id || undefined,
        candidate_name: callData?.candidate_name || undefined,
        phone: callData?.phone_number || undefined,
        scheduled_time: callbackDate,
        status: "pending",
      });

      if (error) throw error;
      toast.success("Callback scheduled");
      setCallbackDate("");
    } catch {
      toast.error("Failed to schedule callback");
    }
  };

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
      case "no-answer":
        return <Badge className="bg-warning/20 text-warning border-0">No Answer</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-destructive/20 text-destructive border-0">Failed</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    switch (outcome?.toLowerCase()) {
      case "interested":
        return "Interested";
      case "callback_requested":
        return "Callback Requested";
      case "not_interested":
        return "Not Interested";
      case "voicemail":
        return "Voicemail Left";
      case "no_answer":
        return "No Answer";
      default:
        return outcome || "—";
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
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {callData?.candidate_name || conversation.candidateName || "Unknown"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {callData?.phone_number || conversation.candidatePhone || "No phone number"}
            </p>
          </div>
        </div>
        
        {/* Badges row */}
        <div className="flex items-center gap-2 mt-3">
          {callData?.call_type === "ai" || conversation.id.includes("ai") ? (
            <Badge className="bg-cyan-500/20 text-cyan-400 border-0">AI Call</Badge>
          ) : (
            <Badge variant="secondary">Manual</Badge>
          )}
          {getStatusBadge(callData?.status)}
          <Badge variant="outline" className="font-mono">
            {formatDuration(callData?.duration_seconds)}
          </Badge>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Info Card */}
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date/Time</span>
                <p className="font-medium">
                  {callData?.started_at || callData?.created_at
                    ? format(new Date(callData?.started_at || callData?.created_at || ""), "MMM d, yyyy h:mm a")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">From</span>
                <p className="font-medium font-mono text-xs">
                  {callData?.from_number || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">To</span>
                <p className="font-medium font-mono text-xs">
                  {callData?.phone_number || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Campaign</span>
                <p className="font-medium">{campaign?.name || "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Outcome</span>
                <p className="font-medium">{getOutcomeLabel(callData?.call_result)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transcript Section */}
        {callData?.transcript_text && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Call Transcript</h3>
            <div className="bg-muted/30 rounded-lg p-4 max-h-[250px] overflow-y-auto">
              <div className="space-y-2 text-sm whitespace-pre-wrap">
                {callData.transcript_text.split("\n").map((line, i) => {
                  const isAgent = line.toLowerCase().startsWith("agent:") || line.toLowerCase().startsWith("ai:");
                  const isUser = line.toLowerCase().startsWith("user:") || line.toLowerCase().startsWith("candidate:");
                  
                  return (
                    <div
                      key={i}
                      className={cn(
                        "px-3 py-2 rounded-lg",
                        isAgent && "bg-primary/10 ml-4",
                        isUser && "bg-muted mr-4",
                        !isAgent && !isUser && "text-muted-foreground"
                      )}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recording Section */}
        {callData?.recording_url && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Recording</h3>
            <div className="flex items-center gap-3">
              <audio controls className="flex-1 h-10">
                <source src={callData.recording_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(callData.recording_url!, "_blank")}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Notes</h3>
          <Textarea
            placeholder="Add notes about this call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <Button
            onClick={() => saveNotesMutation.mutate()}
            disabled={saveNotesMutation.isPending}
            size="sm"
            className="mt-2"
          >
            {saveNotesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 border-t border-border bg-card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => toast.info("Opening dialer...")}
            className="gradient-primary"
          >
            <PhoneCall className="h-4 w-4 mr-1" />
            Call Back
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Open SMS compose - we'll show a toast with instructions for now
              const phone = callData?.phone_number;
              if (phone) {
                navigator.clipboard.writeText(phone);
                toast.success(`Phone copied: ${phone}. Use the + button to send SMS.`);
              } else {
                toast.info("No phone number available");
              }
            }}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Send SMS
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-1" />
                Schedule Callback
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <Label>Select date and time</Label>
                <Input
                  type="datetime-local"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                />
                <Button onClick={scheduleCallback} className="w-full" size="sm">
                  Confirm Callback
                </Button>
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
  const [interestLevel, setInterestLevel] = useState("not_set");
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

  // Send SMS mutation using supabase.functions.invoke (secure)
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
      const { data, error } = await supabase.functions.invoke("sms-campaign-send", {
        body: {
          to_phone: conversation.candidatePhone,
          custom_message: messageText,
          from_number: "+12185628671",
        },
      });

      if (error) {
        throw error;
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

  // Handle AI suggestion selection
  const handleAISuggestion = useCallback((text: string) => {
    setMessageText(text);
  }, []);

  // Get last inbound message for AI suggestions
  const lastInboundMessage = messages
    .filter((m) => m.direction === "inbound")
    .slice(-1)[0]?.body || null;

  // Keyboard shortcuts for AI suggestions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        // Keyboard shortcut feedback - actual insertion handled by AIReplyPanel
        toast.info(`Use suggestion ${e.key}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Call conversation view
  if (conversation.channel === "call") {
    return <CallDetailView conversation={conversation} />;
  }

  // Interest level options
  const interestLevels = [
    { value: "not_set", label: "Not Set", color: "text-muted-foreground" },
    { value: "cold", label: "Cold", color: "text-blue-400" },
    { value: "warm", label: "Warm", color: "text-yellow-400" },
    { value: "hot", label: "Hot", color: "text-orange-500" },
    { value: "placed", label: "Placed", color: "text-green-500" },
  ];

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleScheduleCallback = () => {
    toast.info("Schedule callback coming soon");
  };

  const handleOptOut = async () => {
    if (!conversation?.candidateId) {
      toast.error("No candidate linked");
      return;
    }
    try {
      await supabase
        .from("candidates")
        .update({ sms_opt_out: true })
        .eq("id", conversation.candidateId);
      toast.success("Candidate opted out from SMS");
    } catch {
      toast.error("Failed to opt out");
    }
  };

  // SMS conversation view
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-start justify-between">
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
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => handleCopyToClipboard(conversation.candidatePhone || "", "Phone")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                  title="Click to copy"
                >
                  {conversation.candidatePhone || "No phone number"}
                </button>
                {conversation.candidateEmail && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <button
                      onClick={() => handleCopyToClipboard(conversation.candidateEmail || "", "Email")}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      title="Click to copy"
                    >
                      {conversation.candidateEmail}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Interest Level Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <span className={interestLevels.find(l => l.value === interestLevel)?.color}>
                    {interestLevels.find(l => l.value === interestLevel)?.label || "Not Set"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {interestLevels.map((level) => (
                  <DropdownMenuItem
                    key={level.value}
                    onClick={() => setInterestLevel(level.value)}
                    className={level.color}
                  >
                    {level.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
                <DropdownMenuItem onClick={() => toast.info("Opening dialer...")}>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleScheduleCallback}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Callback
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleOptOut}
                >
                  Opt Out
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

      {/* AI Reply Suggestions */}
      <AIReplyPanel
        conversationId={conversation.id}
        candidateId={conversation.candidateId}
        campaignId={conversation.campaignId}
        lastInboundMessage={lastInboundMessage}
        onSelectSuggestion={handleAISuggestion}
        channel="sms"
      />

      {/* Reply composer */}
      <div className="flex-shrink-0 border-t border-border bg-card p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Reply via SMS..."
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
