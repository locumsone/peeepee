import { cn } from "@/lib/utils";
import { Flame, MessageSquare, Sparkles } from "lucide-react";

interface JobReplyBadgeProps {
  totalReplies: number;
  hotLeads: number;
  recentReplies?: number; // replies in last 24h
  className?: string;
}

export const JobReplyBadge = ({ 
  totalReplies, 
  hotLeads,
  recentReplies = 0,
  className 
}: JobReplyBadgeProps) => {
  if (totalReplies === 0 && hotLeads === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Hot leads indicator */}
      {hotLeads > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">
          <Flame className="h-3 w-3" />
          <span>{hotLeads} hot</span>
        </div>
      )}

      {/* Recent replies indicator */}
      {recentReplies > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/20 text-success text-xs font-medium">
          <Sparkles className="h-3 w-3" />
          <span>{recentReplies} new</span>
        </div>
      )}

      {/* Total replies */}
      {totalReplies > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
          <MessageSquare className="h-3 w-3" />
          <span>{totalReplies} replies</span>
        </div>
      )}
    </div>
  );
};

export default JobReplyBadge;
