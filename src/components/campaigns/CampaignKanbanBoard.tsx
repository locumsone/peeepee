import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MapPin, Users, DollarSign } from "lucide-react";
import { CampaignHealthIndicator, calculateHealth } from "./CampaignHealthIndicator";
import type { CampaignWithJob } from "./types";

interface CampaignKanbanBoardProps {
  campaigns: CampaignWithJob[];
  onStatusChange: (campaignId: string, newStatus: string) => void;
}

type KanbanColumn = {
  status: string;
  label: string;
  color: string;
};

const columns: KanbanColumn[] = [
  { status: "draft", label: "Draft", color: "border-muted-foreground" },
  { status: "active", label: "Active", color: "border-success" },
  { status: "paused", label: "Paused", color: "border-warning" },
  { status: "completed", label: "Completed", color: "border-primary" },
];

export const CampaignKanbanBoard = ({
  campaigns,
  onStatusChange,
}: CampaignKanbanBoardProps) => {
  const navigate = useNavigate();

  const getCampaignsByStatus = (status: string) => {
    return campaigns.filter((c) => (c.status || "draft") === status);
  };

  const handleDragStart = (e: React.DragEvent, campaignId: string) => {
    e.dataTransfer.setData("campaignId", campaignId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData("campaignId");
    if (campaignId) {
      onStatusChange(campaignId, newStatus);
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-[900px]">
        {columns.map((column) => {
          const columnCampaigns = getCampaignsByStatus(column.status);
          return (
            <div
              key={column.status}
              className="flex-1 min-w-[280px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div
                className={cn(
                  "rounded-t-lg bg-card border-t-4 p-3 flex items-center justify-between",
                  column.color
                )}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnCampaigns.length}
                  </Badge>
                </div>
              </div>

              {/* Column Content */}
              <div className="bg-secondary/20 rounded-b-lg p-2 min-h-[400px] space-y-2">
                {columnCampaigns.map((campaign) => {
                  const job = campaign.jobs;
                  const health = calculateHealth(
                    campaign.emails_sent || 0,
                    campaign.emails_opened || 0,
                    campaign.emails_bounced || 0
                  );

                  return (
                    <div
                      key={campaign.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, campaign.id)}
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      className={cn(
                        "bg-card rounded-lg p-3 shadow-sm border border-border cursor-pointer",
                        "hover:shadow-md hover:border-primary/30 transition-all",
                        "active:scale-[0.98]"
                      )}
                    >
                      {/* Card Header */}
                      <div className="flex items-start gap-2 mb-2">
                        <CampaignHealthIndicator
                          emailsSent={campaign.emails_sent || 0}
                          emailsOpened={campaign.emails_opened || 0}
                          emailsBounced={campaign.emails_bounced || 0}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm text-foreground truncate">
                            {campaign.name || "Untitled"}
                          </h4>
                          {job?.specialty && (
                            <p className="text-xs text-muted-foreground truncate">
                              {job.specialty}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Job Context */}
                      {job && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                          {job.facility_name && (
                            <span className="truncate max-w-[100px]">{job.facility_name}</span>
                          )}
                          {(job.city || job.state) && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {job.state}
                            </span>
                          )}
                          {job.pay_rate && (
                            <span className="flex items-center gap-0.5 text-success">
                              <DollarSign className="h-3 w-3" />
                              {job.pay_rate}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {campaign.leads_count || 0}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {campaign.emails_sent || 0} sent
                        </span>
                        {(campaign.emails_opened || 0) > 0 && (
                          <span
                            className={cn(
                              "font-mono",
                              health === "healthy"
                                ? "text-success"
                                : health === "warning"
                                ? "text-warning"
                                : "text-destructive"
                            )}
                          >
                            {(
                              ((campaign.emails_opened || 0) / (campaign.emails_sent || 1)) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {columnCampaigns.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No campaigns
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
