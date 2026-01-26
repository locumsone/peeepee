import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, FolderOpen, Inbox, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string | null;
  status: string | null;
}

interface CampaignFilterProps {
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string | null) => void;
}

export const CampaignFilter = ({
  selectedCampaignId,
  onSelectCampaign,
}: CampaignFilterProps) => {
  const [open, setOpen] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .in("status", ["active", "draft"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });

  const getSelectedLabel = () => {
    if (selectedCampaignId === null) return "All Campaigns";
    if (selectedCampaignId === "unassigned") return "Unassigned";
    const campaign = campaigns.find((c) => c.id === selectedCampaignId);
    return campaign?.name || "Select Campaign";
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{getSelectedLabel()}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          onClick={() => {
            onSelectCampaign(null);
            setOpen(false);
          }}
          className="gap-2"
        >
          <Inbox className="h-4 w-4" />
          <span className="flex-1">All Campaigns</span>
          {selectedCampaignId === null && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onSelectCampaign("unassigned");
            setOpen(false);
          }}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          <span className="flex-1">Unassigned</span>
          {selectedCampaignId === "unassigned" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        {campaigns.length > 0 && <DropdownMenuSeparator />}

        {campaigns.map((campaign) => (
          <DropdownMenuItem
            key={campaign.id}
            onClick={() => {
              onSelectCampaign(campaign.id);
              setOpen(false);
            }}
            className="gap-2"
          >
            <div className="flex-1 min-w-0">
              <span className="truncate block">{campaign.name || "Unnamed"}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 border-0 flex-shrink-0",
                campaign.status === "active" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {campaign.status}
            </Badge>
            {selectedCampaignId === campaign.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
