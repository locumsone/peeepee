import { Phone, MessageSquare, Mail, Clock, Flame, Zap, Moon, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface CampaignLead {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_specialty: string | null;
  candidate_state: string | null;
  status: string | null;
  tier: number | null;
  emails_sent: number | null;
  emails_opened: number | null;
  emails_replied: number | null;
  sms_sent: number | null;
  sms_replied: number | null;
  calls_attempted: number | null;
  calls_connected: number | null;
  last_contact_at: string | null;
  updated_at: string | null;
  interest_level: string | null;
  sentiment: string | null;
}

interface JobCandidateCardProps {
  lead: CampaignLead;
  onCall?: (lead: CampaignLead) => void;
  onSMS?: (lead: CampaignLead) => void;
  onEmail?: (lead: CampaignLead) => void;
  onClick?: (lead: CampaignLead) => void;
}

const getEngagementIndicator = (lead: CampaignLead) => {
  const now = new Date();
  const lastContact = lead.last_contact_at ? new Date(lead.last_contact_at) : null;
  const daysSinceContact = lastContact 
    ? (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24) 
    : null;

  // Hot: replied within 24 hours
  if ((lead.emails_replied || 0) > 0 || (lead.sms_replied || 0) > 0) {
    if (daysSinceContact && daysSinceContact <= 1) {
      return { icon: Flame, label: "Hot Lead", className: "text-orange-500" };
    }
    return { icon: Zap, label: "Active", className: "text-yellow-500" };
  }

  // Active: opened/clicked in last 7 days
  if ((lead.emails_opened || 0) > 0 && daysSinceContact && daysSinceContact <= 7) {
    return { icon: Zap, label: "Active", className: "text-yellow-500" };
  }

  // Cold: no engagement in 14+ days
  if (daysSinceContact && daysSinceContact >= 14) {
    return { icon: Moon, label: "Cold", className: "text-muted-foreground" };
  }

  return null;
};

const getStatusColor = (status: string | null) => {
  switch (status) {
    case "sourced": return "bg-muted text-muted-foreground";
    case "contacted": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "engaged": return "bg-warning/20 text-warning border-warning/30";
    case "interested": return "bg-success/20 text-success border-success/30";
    case "submitted": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "placed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "not_interested": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground";
  }
};

export const JobCandidateCard = ({ lead, onCall, onSMS, onEmail, onClick }: JobCandidateCardProps) => {
  const engagement = getEngagementIndicator(lead);
  const EngagementIcon = engagement?.icon;

  return (
    <div
      onClick={() => onClick?.(lead)}
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-all cursor-pointer",
        "hover:border-primary/50 hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">
              {lead.candidate_name || "Unknown Candidate"}
            </h4>
            {engagement && EngagementIcon && (
              <EngagementIcon className={cn("h-4 w-4 flex-shrink-0", engagement.className)} />
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {lead.candidate_specialty || "—"} • {lead.candidate_state || "—"}
          </p>
        </div>
        <Badge variant="outline" className={cn("flex-shrink-0 capitalize", getStatusColor(lead.status))}>
          {lead.status?.replace("_", " ") || "pending"}
        </Badge>
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          <span>{lead.emails_sent || 0} sent</span>
          {(lead.emails_replied || 0) > 0 && (
            <span className="text-success">• {lead.emails_replied} reply</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span>{lead.sms_sent || 0} sent</span>
          {(lead.sms_replied || 0) > 0 && (
            <span className="text-success">• {lead.sms_replied} reply</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          <span>{lead.calls_connected || 0}/{lead.calls_attempted || 0}</span>
        </div>
      </div>

      {/* Last contact */}
      {lead.last_contact_at && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Clock className="h-3 w-3" />
          <span>Last contact {formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: true })}</span>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onCall?.(lead); }}
          disabled={!lead.candidate_phone}
        >
          <Phone className="h-3 w-3 mr-1" />
          Call
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onSMS?.(lead); }}
          disabled={!lead.candidate_phone}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          SMS
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onEmail?.(lead); }}
          disabled={!lead.candidate_email}
        >
          <Mail className="h-3 w-3 mr-1" />
          Email
        </Button>
      </div>
    </div>
  );
};

export default JobCandidateCard;
