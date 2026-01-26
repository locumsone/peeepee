import { Search, MessageSquare, Phone, Loader2, Flame, Star, Snowflake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ConversationItem } from "@/pages/Communications";
import type { PriorityLevel } from "./PriorityBadge";

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (conversation: ConversationItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

const priorityBorderColors: Record<PriorityLevel, string> = {
  urgent: "border-l-4 border-l-red-500",
  hot: "border-l-4 border-l-orange-500",
  warm: "border-l-4 border-l-yellow-500",
  cold: "border-l-4 border-l-slate-500",
};

const priorityIcons: Record<PriorityLevel, React.ReactNode> = {
  urgent: <Flame className="h-3.5 w-3.5 text-red-500" />,
  hot: <Star className="h-3.5 w-3.5 text-orange-500" />,
  warm: null,
  cold: <Snowflake className="h-3.5 w-3.5 text-slate-400" />,
};

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
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return "";
    }
  };

  const truncatePreview = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 bg-muted/50 border-0 text-sm"
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
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => {
              const priority = conversation.priorityLevel || "cold";
              const isSelected = selectedId === conversation.id;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    "w-full px-4 py-3 flex items-start gap-3 text-left transition-all",
                    "border-b border-border/50",
                    priorityBorderColors[priority],
                    isSelected 
                      ? "bg-primary/10" 
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Avatar / Channel icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center relative",
                      conversation.channel === "sms"
                        ? "bg-accent/20 text-accent"
                        : "bg-success/20 text-success"
                    )}
                  >
                    {conversation.channel === "sms" ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-foreground truncate text-sm">
                          {conversation.candidateName}
                        </span>
                        {priorityIcons[priority]}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTimeAgo(conversation.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {truncatePreview(conversation.preview)}
                    </p>

                    {/* Phone number and duration */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {conversation.candidatePhone}
                      </span>
                      {conversation.channel === "call" && conversation.duration && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {Math.floor(conversation.duration / 60)}:{(conversation.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {conversation.unreadCount > 0 && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-foreground">
                        {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
