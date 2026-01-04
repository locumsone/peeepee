import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FolderOpen, Inbox, Users } from "lucide-react";

interface Campaign {
  id: string;
  name: string | null;
  status: string | null;
  leads_count: number | null;
}

interface CampaignNavigatorProps {
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string | null) => void;
}

export const CampaignNavigator = ({
  selectedCampaignId,
  onSelectCampaign,
}: CampaignNavigatorProps) => {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns-nav"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, leads_count")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-success/20 text-success";
      case "paused":
        return "bg-warning/20 text-warning";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "draft":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          Campaigns
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All Campaigns option */}
          <button
            onClick={() => onSelectCampaign(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
              selectedCampaignId === null
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-foreground"
            )}
          >
            <Inbox className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium truncate">All Campaigns</span>
          </button>

          {/* Unassigned option */}
          <button
            onClick={() => onSelectCampaign("unassigned")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
              selectedCampaignId === "unassigned"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-sm truncate">Unassigned</span>
          </button>

          {/* Divider */}
          <div className="h-px bg-border my-2" />

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Campaign list */}
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => onSelectCampaign(campaign.id)}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left transition-colors",
                selectedCampaignId === campaign.id
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      selectedCampaignId === campaign.id
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {campaign.name || "Unnamed Campaign"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 border-0", getStatusColor(campaign.status))}
                  >
                    {campaign.status || "draft"}
                  </Badge>
                  {(campaign.leads_count ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {campaign.leads_count} leads
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {!isLoading && campaigns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No campaigns found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
