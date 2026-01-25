import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Send, 
  Sparkles, 
  Undo2, 
  Check, 
  Loader2,
  Scissors,
  Stethoscope,
  Ban,
  DollarSign,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageRefinerProps {
  messageType: "email" | "sms";
  currentSubject?: string;
  currentBody: string;
  candidateContext: {
    name: string;
    specialty?: string;
    licenses?: string[];
  };
  jobContext: {
    rate: string;
    location: string;
    call_status?: string;
    facility_name?: string;
  };
  playbookData?: any;
  onApply: (refinedSubject: string | undefined, refinedBody: string) => void;
  onClose?: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  changes?: string[];
  wordCount?: number;
}

const QUICK_ACTIONS = [
  { id: "shorten", label: "Shorten", icon: Scissors, description: "100-120 words" },
  { id: "more_clinical", label: "More Clinical", icon: Stethoscope, description: "Add procedures" },
  { id: "less_salesy", label: "Less Salesy", icon: Ban, description: "Remove recruiter-speak" },
  { id: "emphasize_rate", label: "Rate First", icon: DollarSign, description: "Lead with pay" },
  { id: "emphasize_location", label: "Location First", icon: MapPin, description: "Lead with geography" },
];

export function MessageRefiner({
  messageType,
  currentSubject,
  currentBody,
  candidateContext,
  jobContext,
  playbookData,
  onApply,
  onClose,
}: MessageRefinerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinedSubject, setRefinedSubject] = useState<string | undefined>(currentSubject);
  const [refinedBody, setRefinedBody] = useState(currentBody);
  const [history, setHistory] = useState<{ subject?: string; body: string }[]>([
    { subject: currentSubject, body: currentBody }
  ]);

  const handleRefine = async (prompt: string) => {
    if (!prompt.trim()) return;

    setIsRefining(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: prompt }]);
    setInputValue("");

    try {
      const { data, error } = await supabase.functions.invoke("refine-message", {
        body: {
          message_type: messageType,
          current_subject: refinedSubject,
          current_body: refinedBody,
          refinement_prompt: prompt,
          candidate_context: candidateContext,
          job_context: jobContext,
          playbook_data: playbookData,
        },
      });

      if (error) throw error;

      if (data.success) {
        const newSubject = data.refined_subject;
        const newBody = data.refined_body;
        
        // Save to history for undo
        setHistory(prev => [...prev, { subject: newSubject, body: newBody }]);
        
        // Update current state
        if (newSubject) setRefinedSubject(newSubject);
        setRefinedBody(newBody);
        
        // Add assistant response
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✓ Revised. ${data.changes_made?.join(', ') || 'Content refined.'}`,
          changes: data.changes_made,
          wordCount: data.word_count,
        }]);

        if (data.credits_exhausted) {
          toast.warning("AI credits exhausted - no changes made");
        }
      } else {
        throw new Error(data.error || "Refinement failed");
      }
    } catch (error) {
      console.error("Refine error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : 'Failed to refine'}`,
      }]);
      toast.error("Failed to refine message");
    } finally {
      setIsRefining(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    handleRefine(actionId);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previous = newHistory[newHistory.length - 1];
    
    setHistory(newHistory);
    setRefinedSubject(previous.subject);
    setRefinedBody(previous.body);
    
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "↩ Reverted to previous version",
    }]);
    
    toast.info("Reverted to previous version");
  };

  const handleApply = () => {
    onApply(refinedSubject, refinedBody);
    toast.success("Changes applied");
  };

  const wordCount = refinedBody.split(/\s+/).length;
  const charCount = refinedBody.length;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI Message Assistant</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {messageType === "email" ? "Email" : "SMS"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Currently editing: {candidateContext.name}'s {messageType}
        </p>
        <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          {messageType === "sms" && (
            <span className={cn(charCount > 300 ? "text-destructive" : "")}>
              {charCount}/300 chars
            </span>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Use quick actions below or type a custom refinement</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "p-3 rounded-lg text-sm",
                msg.role === "user" 
                  ? "bg-primary/10 ml-8" 
                  : "bg-muted mr-8"
              )}
            >
              <p>{msg.content}</p>
              {msg.wordCount && (
                <p className="text-xs text-muted-foreground mt-1">
                  Now {msg.wordCount} words
                </p>
              )}
            </div>
          ))}
          
          {isRefining && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mr-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Refining...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handleQuickAction(action.id)}
              disabled={isRefining}
            >
              <action.icon className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleRefine(inputValue);
          }}
          className="flex gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Custom refinement (e.g., 'Add urgency')"
            className="text-sm"
            disabled={isRefining}
          />
          <Button type="submit" size="icon" disabled={isRefining || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={history.length <= 1 || isRefining}
          className="flex-1"
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Undo
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={isRefining}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-1" />
          Apply
        </Button>
      </div>
    </div>
  );
}
