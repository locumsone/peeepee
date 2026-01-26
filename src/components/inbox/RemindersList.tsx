import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { 
  Clock, 
  MessageSquare, 
  X,
  Bell,
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { ConversationItem } from "@/pages/Communications";
import { useSoftphoneActions } from "@/hooks/useSoftphoneActions";

interface ScheduledCallback {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  phone: string;
  scheduled_time: string;
  status: string;
  notes?: string | null;
}

interface RemindersListProps {
  conversations: ConversationItem[];
  onSelect: (conversation: ConversationItem) => void;
  selectedId: string | null;
}

export const RemindersList = ({ conversations, onSelect, selectedId }: RemindersListProps) => {
  const queryClient = useQueryClient();
  const { initiateCall } = useSoftphoneActions();
  
  // Fetch scheduled callbacks
  const { data: scheduledCallbacks = [] } = useQuery({
    queryKey: ["scheduled-callbacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_callbacks")
        .select("*")
        .eq("status", "pending")
        .order("scheduled_time", { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduledCallback[];
    },
  });

  // Filter to only conversations with reminders
  const reminders = conversations.filter(c => c.reminderAt || c.snoozedUntil);
  
  // Sort by reminder time (overdue first, then upcoming)
  const sortedReminders = [...reminders].sort((a, b) => {
    const aTime = new Date(a.reminderAt || a.snoozedUntil || "").getTime();
    const bTime = new Date(b.reminderAt || b.snoozedUntil || "").getTime();
    const aOverdue = isPast(new Date(a.reminderAt || a.snoozedUntil || ""));
    const bOverdue = isPast(new Date(b.reminderAt || b.snoozedUntil || ""));
    
    // Overdue items first
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Then sort by time
    return aTime - bTime;
  });

  const clearReminderMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("sms_conversations")
        .update({ 
          reminder_at: null, 
          reminder_note: null,
          snoozed_until: null 
        })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
      toast.success("Reminder cleared");
    },
    onError: () => {
      toast.error("Failed to clear reminder");
    },
  });

  const completeCallbackMutation = useMutation({
    mutationFn: async (callbackId: string) => {
      const { error } = await supabase
        .from("scheduled_callbacks")
        .update({ status: "completed" })
        .eq("id", callbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-callbacks"] });
      toast.success("Callback marked complete");
    },
    onError: () => {
      toast.error("Failed to update callback");
    },
  });

  const handleCallCallback = (callback: ScheduledCallback) => {
    initiateCall({
      phoneNumber: callback.phone,
      candidateName: callback.candidate_name || undefined,
      candidateId: callback.candidate_id || undefined,
    });
    toast.success(`Calling ${callback.candidate_name || callback.phone}...`);
  };

  const hasAnyItems = reminders.length > 0 || scheduledCallbacks.length > 0;

  if (!hasAnyItems) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Bell className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          No Reminders
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Snooze conversations or schedule callbacks to have them appear here.
        </p>
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">H</kbd> Later today</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">T</kbd> Tomorrow</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">W</kbd> Next week</span>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {/* Scheduled Callbacks Section */}
        {scheduledCallbacks.length > 0 && (
          <>
            <h3 className="text-xs font-medium text-muted-foreground px-2 py-1 mb-2 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Scheduled Callbacks ({scheduledCallbacks.length})
            </h3>
            {scheduledCallbacks.map((callback) => {
              const callbackDate = new Date(callback.scheduled_time);
              const isOverdue = isPast(callbackDate);

              return (
                <div
                  key={callback.id}
                  className={cn(
                    "rounded-lg border mb-2 transition-all",
                    isOverdue 
                      ? "border-destructive/50 bg-destructive/5" 
                      : "border-success/30 bg-success/5"
                  )}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        isOverdue ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                      )}>
                        <Phone className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {callback.candidate_name || "Unknown"}
                          </span>
                          <Badge 
                            variant={isOverdue ? "destructive" : "outline"}
                            className={cn(
                              "text-[10px] flex-shrink-0",
                              !isOverdue && "border-success/50 text-success"
                            )}
                          >
                            {isOverdue ? "Overdue" : formatDistanceToNow(callbackDate, { addSuffix: true })}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatPhoneNumber(callback.phone)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            • {format(callbackDate, "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 gradient-primary"
                      onClick={() => handleCallCallback(callback)}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => completeCallbackMutation.mutate(callback.id)}
                      disabled={completeCallbackMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Done
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* SMS Reminders Section */}
        {sortedReminders.length > 0 && (
          <>
            {scheduledCallbacks.length > 0 && (
              <h3 className="text-xs font-medium text-muted-foreground px-2 py-1 mb-2 mt-4 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                SMS Reminders ({sortedReminders.length})
              </h3>
            )}
            {sortedReminders.map((conversation) => {
              const reminderDate = new Date(conversation.reminderAt || conversation.snoozedUntil || "");
              const isOverdue = isPast(reminderDate);
              const isSelected = selectedId === conversation.id;

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "rounded-lg border mb-2 transition-all",
                    isOverdue 
                      ? "border-destructive/50 bg-destructive/5" 
                      : "border-border bg-card",
                    isSelected && "ring-2 ring-primary"
                  )}
                >
                  <button
                    onClick={() => onSelect(conversation)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        isOverdue ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"
                      )}>
                        {isOverdue ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {conversation.candidateName}
                          </span>
                          <Badge 
                            variant={isOverdue ? "destructive" : "outline"} 
                            className="text-[10px] flex-shrink-0"
                          >
                            {isOverdue ? "Overdue" : formatDistanceToNow(reminderDate, { addSuffix: true })}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conversation.preview}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatPhoneNumber(conversation.candidatePhone)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            • {format(reminderDate, "MMM d, h:mm a")}
                          </span>
                        </div>
                        
                        {conversation.reminderNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{conversation.reminderNote}"
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(conversation);
                      }}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearReminderMutation.mutate(conversation.id);
                      }}
                      disabled={clearReminderMutation.isPending}
                    >
                      {clearReminderMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearReminderMutation.mutate(conversation.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </ScrollArea>
  );
};
