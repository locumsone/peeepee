import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  text: string;
  intent: string;
  confidence: number;
}

interface InlineAISuggestionsProps {
  conversationId: string;
  candidateId?: string | null;
  campaignId?: string | null;
  lastInboundMessage: string | null;
  onSelectSuggestion: (text: string) => void;
  channel: "sms" | "call";
}

const sentimentConfig: Record<string, { label: string; className: string }> = {
  interested: { label: "Interested", className: "bg-success/20 text-success border-success/30" },
  question: { label: "Question", className: "bg-primary/20 text-primary border-primary/30" },
  not_interested: { label: "Not Interested", className: "bg-muted text-muted-foreground border-border" },
  opt_out: { label: "Opt-Out", className: "bg-destructive/20 text-destructive border-destructive/30" },
  neutral: { label: "Neutral", className: "bg-secondary text-secondary-foreground border-border" },
};

export const InlineAISuggestions = ({
  conversationId,
  candidateId,
  campaignId,
  lastInboundMessage,
  onSelectSuggestion,
  channel,
}: InlineAISuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sentiment, setSentiment] = useState<string>("neutral");
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

  if (!lastInboundMessage) {
    return null;
  }

  const sentimentInfo = sentimentConfig[sentiment] || sentimentConfig.neutral;

  return (
    <div className="px-4 py-3 bg-gradient-to-b from-muted/50 to-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">AI Suggestions</span>
          {hasGenerated && (
            <Badge variant="outline" className={cn("text-[10px] px-2 py-0", sentimentInfo.className)}>
              {sentimentInfo.label}
            </Badge>
          )}
        </div>
        {hasGenerated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={generateMutation.isPending}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", generateMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      {/* Suggestions */}
      {generateMutation.isPending ? (
        <div className="flex items-center gap-2 py-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Analyzing message...</span>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 3).map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => {
                onSelectSuggestion(suggestion.text);
                toast.success("Suggestion inserted");
              }}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg text-left",
                "bg-card border border-border",
                "hover:border-primary/50 hover:bg-primary/5",
                "transition-all duration-150"
              )}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <span className="text-xs text-foreground line-clamp-1 max-w-[180px]">
                {suggestion.text}
              </span>
            </button>
          ))}
        </div>
      ) : hasGenerated ? (
        <p className="text-xs text-muted-foreground py-1">No suggestions available</p>
      ) : (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Generate Suggestions
        </Button>
      )}

      {/* Keyboard hint */}
      {suggestions.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Press <kbd className="px-1 py-0.5 bg-muted rounded">1</kbd>{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded">2</kbd>{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded">3</kbd> to insert
        </p>
      )}
    </div>
  );
};
