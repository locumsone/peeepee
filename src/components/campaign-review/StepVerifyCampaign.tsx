import { MapPin, DollarSign, Calendar, Mail, MessageSquare, Phone, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { Job, ChannelConfig } from "./types";

interface StepVerifyCampaignProps {
  job: Job | null;
  channels: ChannelConfig;
  campaignName: string;
}

export function StepVerifyCampaign({ job, channels, campaignName }: StepVerifyCampaignProps) {
  const navigate = useNavigate();

  const getChannelSummary = () => {
    const parts: string[] = [];
    if (channels.email) {
      parts.push(`Email (${channels.email.sequenceLength || 4} steps)`);
    }
    if (channels.sms) {
      parts.push(`SMS (${channels.sms.sequenceLength || 1} step)`);
    }
    if (channels.aiCall) {
      parts.push("AI Call");
    }
    if (channels.linkedin) {
      parts.push("LinkedIn");
    }
    return parts.length > 0 ? parts.join(" + ") : "No channels configured";
  };

  const formatRate = () => {
    if (job?.hourly_rate) return `$${job.hourly_rate}/hr`;
    if (job?.bill_rate) return `$${job.bill_rate}/hr (bill)`;
    if (job?.pay_rate) return `$${job.pay_rate}/hr`;
    return "Rate TBD";
  };

  return (
    <div className="space-y-4">
      {/* Job Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-foreground">
            {job?.specialty || job?.job_name || "Position"}
          </h4>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{job?.facility_name || "Facility"}</span>
              {(job?.city || job?.state) && (
                <span>· {[job?.city, job?.state].filter(Boolean).join(", ")}</span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium text-foreground">{formatRate()}</span>
            </div>
            
            {job?.start_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Starting {new Date(job.start_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Outreach Sequence
          </h4>
          
          <div className="flex flex-wrap gap-2">
            {channels.email && (
              <Badge variant="secondary" className="gap-1">
                <Mail className="h-3 w-3" />
                Email ({channels.email.sequenceLength || 4} steps)
              </Badge>
            )}
            {channels.sms && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                SMS ({channels.sms.sequenceLength || 1} step)
              </Badge>
            )}
            {channels.aiCall && (
              <Badge variant="secondary" className="gap-1">
                <Phone className="h-3 w-3" />
                AI Call
              </Badge>
            )}
            {channels.linkedin && (
              <Badge variant="outline" className="gap-1">
                LinkedIn (Manual)
              </Badge>
            )}
          </div>

          {channels.schedule && (
            <p className="text-sm text-muted-foreground">
              Starting: {new Date().toLocaleDateString()} at 9:00 AM
            </p>
          )}
        </div>
      </div>

      {/* Edit Button */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/campaigns/new")}
          className="text-muted-foreground hover:text-foreground"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Job Details
        </Button>
      </div>
    </div>
  );
}
