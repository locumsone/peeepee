import { MessageSquare, Phone } from "lucide-react";
import type { ConversationItem } from "@/pages/Communications";

interface ConversationDetailProps {
  conversation: ConversationItem | null;
}

export const ConversationDetail = ({ conversation }: ConversationDetailProps) => {
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              conversation.channel === "sms"
                ? "bg-accent/20 text-accent"
                : "bg-success/20 text-success"
            }`}
          >
            {conversation.channel === "sms" ? (
              <MessageSquare className="h-5 w-5" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{conversation.candidateName}</h2>
            <p className="text-sm text-muted-foreground">
              {conversation.candidatePhone || "No phone number"}
            </p>
          </div>
        </div>
      </div>

      {/* Message content placeholder */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground">
            Conversation detail view coming soon
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {conversation.channel === "sms" ? "SMS messages" : "Call transcript"} will appear here
          </p>
        </div>
      </div>
    </div>
  );
};
