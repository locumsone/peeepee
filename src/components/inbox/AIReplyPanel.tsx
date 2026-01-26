import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Lightbulb, MessageSquare, Calendar, HelpCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Suggestion {
  id: string;
  text: string;
  intent: string;
  confidence: number;
}

interface AIReplyPanelProps {
  conversationId: string;
  candidateId?: string | null;
  campaignId?: string | null;
  lastInboundMessage: string | null;
  onSelectSuggestion: (text: string) => void;
  channel: "sms" | "call";
}

const intentIcons: Record<string, React.ReactNode> = {
  answer_question: <HelpCircle className="h-3.5 w-3.5" />,
  schedule_call: <Calendar className="h-3.5 w-3.5" />,
  confirm_interest: <Sparkles className="h-3.5 w-3.5" />,
  provide_info: <Lightbulb className="h-3.5 w-3.5" />,
  re_engage: <MessageSquare className="h-3.5 w-3.5" />,
  address_concern: <MessageSquare className="h-3.5 w-3.5" />,
};

const intentLabels: Record<string, string> = {
  answer_question: "Answer",
  schedule_call: "Schedule",
  confirm_interest: "Confirm",
  provide_info: "Info",
  re_engage: "Re-engage",
  address_concern: "Address",
};

const sentimentBadges: Record<string, { label: string; className: string }> = {
  interested: { label: "🔥 Interested", className: "bg-success/20 text-success" },
  question: { label: "❓ Question", className: "bg-primary/20 text-primary" },
  not_interested: { label: "❄️ Not Interested", className: "bg-muted text-muted-foreground" },
  opt_out: { label: "🚫 Opt-Out", className: "bg-destructive/20 text-destructive" },
  neutral: { label: "💬 Neutral", className: "bg-secondary text-secondary-foreground" },
};

export const AIReplyPanel = ({
  conversationId,
  candidateId,
  campaignId,
  lastInboundMessage,
  onSelectSuggestion,
  channel,
}: AIReplyPanelProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sentiment, setSentiment] = useState<string>("neutral");
  const [isOpen, setIsOpen] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("suggest-replies", {
        body: {
          conversation_id: conversationId,
          last_message: lastInboundMessage,
          candidate_id: candidateId,
          campaign_id: campaignId,
          channel,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
      if (data.sentiment) {
        setSentiment(data.sentiment);
      }
      setHasGenerated(true);
    },
    onError: (error: Error) => {
      console.error("Failed to generate suggestions:", error);
      if (error.message.includes("429") || error.message.includes("Rate limit")) {
        toast.error("AI rate limit reached. Try again in a moment.");
      } else if (error.message.includes("402")) {
        toast.error("AI credits exhausted. Please add credits.");
      } else {
        toast.error("Failed to generate suggestions");
      }
    },
  });

  // Auto-generate when there's a new inbound message
  useEffect(() => {
    if (lastInboundMessage && !hasGenerated) {
      generateMutation.mutate();
    }
  }, [lastInboundMessage, conversationId]);

  // Reset when conversation changes
  useEffect(() => {
    setSuggestions([]);
    setSentiment("neutral");
    setHasGenerated(false);
  }, [conversationId]);

  const handleRefresh = () => {
    setHasGenerated(false);
    generateMutation.mutate();
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onSelectSuggestion(suggestion.text);
    toast.success("Suggestion inserted");
  };

  // Don't show if no inbound message to respond to
  if (!lastInboundMessage) {
    return null;
  }

  const sentimentInfo = sentimentBadges[sentiment] || sentimentBadges.neutral;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-border">
      <CollapsibleTrigger asChild>
        <button className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">AI Suggestions</span>
            {hasGenerated && (
              <Badge variant="outline" className={cn("text-[10px] border-0", sentimentInfo.className)}>
                {sentimentInfo.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {generateMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-3 space-y-2">
          {generateMutation.isPending ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Analyzing message...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="grid gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="group w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">
                          {suggestion.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-muted-foreground/30">
                            {intentIcons[suggestion.intent] || <MessageSquare className="h-3 w-3" />}
                            {intentLabels[suggestion.intent] || suggestion.intent}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {suggestion.text.length}/160
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={generateMutation.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">⌘1</kbd>{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">⌘2</kbd>{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">⌘3</kbd> to insert
              </p>
            </>
          ) : hasGenerated ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No suggestions available</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Try Again
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Suggestions
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
