import { useNavigate } from "react-router-dom";
import {
  MoreVertical,
  Play,
  Pause,
  Copy,
  Trash2,
  Eye,
  Mail,
  MessageSquare,
  Phone,
  Users,
  MapPin,
  DollarSign,
  Inbox,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { CampaignHealthIndicator, calculateHealth } from "./CampaignHealthIndicator";
import type { CampaignWithJob } from "./types";

interface CampaignCardProps {
  campaign: CampaignWithJob;
  onPauseResume: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onViewLeads: (id: string) => void;
  onContinueDraft?: (id: string) => void;
}

export const CampaignCard = ({
  campaign,
  onPauseResume,
  onDelete,
  onDuplicate,
  onViewLeads,
  onContinueDraft,
}: CampaignCardProps) => {
  const navigate = useNavigate();

  const job = campaign.jobs;
  const sent = campaign.emails_sent || 0;
  const opened = campaign.emails_opened || 0;
  const replied = campaign.emails_replied || 0;
  const bounced = campaign.emails_bounced || 0;

  const openRate = sent > 0 ? (opened / sent) * 100 : 0;
  const replyRate = sent > 0 ? (replied / sent) * 100 : 0;

  const health = calculateHealth(sent, opened, bounced);
  const isDraft = !campaign.status || campaign.status === "draft";

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-muted text-muted-foreground border-muted-foreground/20">
            Completed
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl bg-card shadow-card border border-border overflow-hidden transition-all hover:shadow-lg",
        campaign.status === "active" && "border-success/30 hover:border-success/50"
      )}
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => navigate(`/campaigns/${campaign.id}`)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <CampaignHealthIndicator
              emailsSent={sent}
              emailsOpened={opened}
              emailsBounced={bounced}
              className="mt-1.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">
                  {campaign.name || "Untitled Campaign"}
                </h3>
                {getStatusBadge(campaign.status)}
              </div>
              
              {/* Job Context */}
              {job && (
                <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground/80">{job.specialty || job.job_name}</span>
                  {job.facility_name && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{job.facility_name}</span>
                    </>
                  )}
                  {(job.city || job.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[job.city, job.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {job.pay_rate && (
                    <span className="flex items-center gap-1 text-success font-medium">
                      <DollarSign className="h-3 w-3" />
                      {job.pay_rate}/hr
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isDraft && onContinueDraft && (
                <DropdownMenuItem onClick={() => onContinueDraft(campaign.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Continue Draft
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {!isDraft && (
                <DropdownMenuItem
                  onClick={() => onPauseResume(campaign.id, campaign.status || "")}
                >
                  {campaign.status === "active" ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDuplicate(campaign.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(campaign.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 pb-3 space-y-3">
        {/* Progress Bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sent</span>
            <span className="font-mono font-medium">{sent}</span>
          </div>
          <Progress value={100} className="h-1.5" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Opened</span>
            <span className={cn(
              "font-mono font-medium",
              openRate >= 30 ? "text-success" : openRate >= 15 ? "text-warning" : "text-muted-foreground"
            )}>
              {opened} ({openRate.toFixed(0)}%)
            </span>
          </div>
          <Progress value={openRate} className="h-1.5" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Replied</span>
            <span className={cn(
              "font-mono font-medium",
              replied > 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {replied} ({replyRate.toFixed(0)}%)
            </span>
          </div>
          <Progress value={replyRate} className="h-1.5" />
        </div>

        {/* Channel Breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{campaign.emails_sent || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{campaign.sms_sent || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{campaign.calls_connected || 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 bg-secondary/30 border-t border-border flex items-center gap-2">
        {isDraft && onContinueDraft ? (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onContinueDraft(campaign.id);
            }}
          >
            <Edit className="h-3 w-3 mr-1" />
            Continue Draft
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onPauseResume(campaign.id, campaign.status || "");
            }}
          >
            {campaign.status === "active" ? (
              <>
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Resume
              </>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onViewLeads(campaign.id);
          }}
        >
          <Users className="h-3 w-3 mr-1" />
          {campaign.leads_count || 0} Leads
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/communications?campaign=${campaign.id}`);
          }}
        >
          <Inbox className="h-3 w-3 mr-1" />
          Inbox
        </Button>
      </div>
    </div>
  );
};
