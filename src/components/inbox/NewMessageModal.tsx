import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Bot, Search, X, ArrowLeft, Loader2, Send, FileText, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSMSSyncTrigger } from "@/hooks/useSMSSync";

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Candidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  specialty: string | null;
}

interface SMSTemplate {
  id: string;
  name: string;
  template_text: string;
}

type Step = 1 | 2 | 3;
type Channel = "sms" | "call" | "ai_call";
type EntryMode = "search" | "manual";

// Phone validation (E.164 format)
const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
};

const formatPhoneForSend = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("1") && cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return `+${cleaned}`;
};

export const NewMessageModal = ({ open, onOpenChange }: NewMessageModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [entryMode, setEntryMode] = useState<EntryMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Manual entry fields
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  
  const queryClient = useQueryClient();
  const triggerSync = useSMSSyncTrigger();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setEntryMode("search");
      setSearchQuery("");
      setSelectedCandidate(null);
      setSelectedChannel(null);
      setMessageText("");
      setManualPhone("");
      setManualName("");
    }
  }, [open]);

  // Search candidates
  const { data: candidates = [], isLoading: searchLoading } = useQuery({
    queryKey: ["candidate-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone, email, specialty")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      return (data || []) as Candidate[];
    },
    enabled: searchQuery.length >= 2 && entryMode === "search",
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
    enabled: step === 3 && selectedChannel === "sms",
  });

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleRemoveCandidate = () => {
    setSelectedCandidate(null);
  };

  const handleSelectChannel = (channel: Channel) => {
    if (channel === "ai_call" && entryMode === "manual") {
      toast.error("AI Call requires an existing contact");
      return;
    }
    
    // For call, trigger softphone directly instead of going to step 3
    if (channel === "call") {
      const phone = getRecipientPhone();
      if (phone) {
        // Dispatch event to open softphone and initiate call
        window.dispatchEvent(new CustomEvent("softphone:call", { detail: { to: phone } }));
        toast.success(`Initiating call to ${recipientName}`);
        onOpenChange(false);
      } else {
        toast.error("No valid phone number for this contact");
      }
      return;
    }
    
    setSelectedChannel(channel);
    setStep(3);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
      setSelectedChannel(null);
    }
  };

  const handleTemplateSelect = (template: SMSTemplate) => {
    setMessageText(template.template_text);
  };

  const getCharCountColor = () => {
    const len = messageText.length;
    if (len >= 160) return "text-destructive";
    if (len >= 140) return "text-warning";
    return "text-muted-foreground";
  };

  // Get recipient phone
  const getRecipientPhone = (): string | null => {
    if (entryMode === "manual") {
      return isValidPhone(manualPhone) ? formatPhoneForSend(manualPhone) : null;
    }
    return selectedCandidate?.phone || null;
  };

  // Get recipient name
  const getRecipientName = (): string => {
    if (entryMode === "manual") {
      return manualName.trim() || formatPhoneForSend(manualPhone);
    }
    if (selectedCandidate) {
      return `${selectedCandidate.first_name || ""} ${selectedCandidate.last_name || ""}`.trim() || "Unknown";
    }
    return "Unknown";
  };

  // Check if can proceed to next step
  const canProceedToChannel = (): boolean => {
    if (entryMode === "manual") {
      return isValidPhone(manualPhone);
    }
    return !!selectedCandidate;
  };

  // Send SMS using supabase.functions.invoke (secure)
  const handleSendSMS = async () => {
    const phone = getRecipientPhone();
    if (!phone || !messageText.trim()) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-campaign-send", {
        body: {
          to_phone: phone,
          custom_message: messageText,
          from_number: "+12185628671",
          candidate_id: entryMode === "search" ? selectedCandidate?.id : null,
          contact_name: entryMode === "manual" ? manualName.trim() || null : null,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("SMS sent successfully");
      // Immediately trigger sync across all components
      triggerSync();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to send SMS");
    } finally {
      setIsSending(false);
    }
  };

  // Queue AI Call
  const handleQueueAICall = async () => {
    if (!selectedCandidate) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from("ai_call_queue").insert({
        candidate_id: selectedCandidate.id,
        candidate_name: `${selectedCandidate.first_name || ""} ${selectedCandidate.last_name || ""}`.trim(),
        phone: selectedCandidate.phone || "",
        status: "pending",
        priority: 1,
      });

      if (error) throw error;

      toast.success("AI call queued successfully");
      queryClient.invalidateQueries({ queryKey: ["ai-call-logs"] });
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to queue AI call");
    } finally {
      setIsSending(false);
    }
  };

  const recipientName = getRecipientName();
  const recipientPhone = getRecipientPhone();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 1 && "Select Recipient"}
              {step === 2 && "Select Channel"}
              {step === 3 && (selectedChannel === "sms" ? "Compose SMS" : "Queue AI Call")}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: Select Recipient */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => {
                  setEntryMode("search");
                  setManualPhone("");
                  setManualName("");
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  entryMode === "search"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="h-4 w-4" />
                Search Contacts
              </button>
              <button
                onClick={() => {
                  setEntryMode("manual");
                  setSelectedCandidate(null);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  entryMode === "manual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserPlus className="h-4 w-4" />
                New Number
              </button>
            </div>

            {entryMode === "search" ? (
              <>
                {/* Selected candidate chip */}
                {selectedCandidate && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="pl-3 pr-1 py-1.5 flex items-center gap-2">
                      <span>{recipientName}</span>
                      <button
                        onClick={handleRemoveCandidate}
                        className="hover:bg-muted rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Search results */}
                <ScrollArea className="h-[200px]">
                  {searchLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      {searchQuery.length >= 2 ? (
                        <p className="text-sm">No candidates found</p>
                      ) : (
                        <p className="text-sm">Type at least 2 characters to search</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {candidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => handleSelectCandidate(candidate)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                            selectedCandidate?.id === candidate.id
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="font-medium text-foreground">
                            {candidate.first_name} {candidate.last_name}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-mono">{candidate.phone || "No phone"}</span>
                            {candidate.specialty && (
                              <>
                                <span>•</span>
                                <span>{candidate.specialty}</span>
                              </>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              /* Manual entry mode */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Phone Number *</label>
                  <Input
                    placeholder="(555) 123-4567"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="mt-1 font-mono"
                  />
                  {manualPhone && !isValidPhone(manualPhone) && (
                    <p className="text-xs text-destructive mt-1">Enter a valid phone number</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Name (optional)</label>
                  <Input
                    placeholder="Dr. John Smith"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Display name for the conversation
                  </p>
                </div>
              </div>
            )}

            {/* Next button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToChannel()}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Channel */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground mb-4">
              Sending to: <span className="font-medium text-foreground">{recipientName}</span>
              {recipientPhone && (
                <span className="text-xs font-mono ml-2 text-muted-foreground">{recipientPhone}</span>
              )}
            </div>

            <div className="grid gap-3">
              {/* SMS */}
              <button
                onClick={() => handleSelectChannel("sms")}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-colors text-left"
              >
                <div className="p-3 rounded-lg bg-accent/20 text-accent">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-medium text-foreground">SMS</div>
                  <div className="text-sm text-muted-foreground">Send text message</div>
                </div>
              </button>

              {/* Call - Opens Softphone */}
              <button
                onClick={() => handleSelectChannel("call")}
                disabled={!recipientPhone}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border border-border text-left transition-colors",
                  !recipientPhone
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted"
                )}
              >
                <div className="p-3 rounded-lg bg-success/20 text-success">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Call</div>
                  <div className="text-sm text-muted-foreground">Make phone call via softphone</div>
                </div>
              </button>

              {/* AI Call */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSelectChannel("ai_call")}
                      disabled={entryMode === "manual"}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border border-border text-left transition-colors",
                        entryMode === "manual"
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="p-3 rounded-lg bg-primary/20 text-primary">
                        <Bot className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">AI Call</div>
                        <div className="text-sm text-muted-foreground">Queue ARIA call</div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  {entryMode === "manual" && (
                    <TooltipContent>
                      <p>AI Call requires an existing contact</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* Step 3: Compose */}
        {step === 3 && selectedChannel === "sms" && (
          <div className="space-y-4">
            {/* To field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">To</label>
              <div className="mt-1 px-3 py-2 rounded-md bg-muted/50 text-foreground font-mono text-sm flex items-center justify-between">
                <span>{recipientPhone || "No phone number"}</span>
                {recipientName && recipientName !== recipientPhone && (
                  <span className="text-muted-foreground text-xs">{recipientName}</span>
                )}
              </div>
            </div>

            {/* Message textarea */}
            <div className="relative">
              <label className="text-sm font-medium text-muted-foreground">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="mt-1 min-h-[120px] resize-none"
              />
              <div className="absolute bottom-2 right-2">
                <span className={cn("text-xs", getCharCountColor())}>
                  {messageText.length}/160
                </span>
              </div>
            </div>

            {/* Template dropdown */}
            {templates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Use Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
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

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendSMS}
                disabled={!messageText.trim() || !recipientPhone || isSending}
                className="gradient-primary"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Call */}
        {step === 3 && selectedChannel === "ai_call" && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{recipientName}</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {recipientPhone || "No phone"}
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                This will queue an AI call with ARIA. The call will be placed automatically based on the call queue schedule.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleQueueAICall}
                disabled={!recipientPhone || isSending}
                className="gradient-primary"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Queueing...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-1" />
                    Queue Call
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
