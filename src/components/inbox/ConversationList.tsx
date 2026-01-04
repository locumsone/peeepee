import { Search, MessageSquare, Phone, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ConversationItem } from "@/pages/Communications";

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (conversation: ConversationItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

export const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  isLoading,
}: ConversationListProps) => {
  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted border-0"
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
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={cn(
                  "w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors",
                  selectedId === conversation.id && "bg-primary/10 hover:bg-primary/15"
                )}
              >
                {/* Channel icon */}
                <div
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    conversation.channel === "sms"
                      ? "bg-accent/20 text-accent"
                      : "bg-success/20 text-success"
                  )}
                >
                  {conversation.channel === "sms" ? (
                    <MessageSquare className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">
                      {conversation.candidateName}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTimeAgo(conversation.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.preview}
                    </p>
                    {/* Show duration for calls */}
                    {conversation.channel === "call" && (conversation as any).duration && (
                      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                        {Math.floor((conversation as any).duration / 60)}:{((conversation as any).duration % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread indicator */}
                {conversation.unreadCount > 0 && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                    <span className="text-[10px] font-bold text-destructive-foreground">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
