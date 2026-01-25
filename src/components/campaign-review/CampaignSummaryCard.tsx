import { Briefcase, Users, Send, Calendar, DollarSign, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import type { Job, ChannelConfig, TierStats } from "./types";

interface CampaignSummaryCardProps {
  job: Job | null;
  candidateCount: number;
  tierStats: TierStats;
  channels: ChannelConfig;
}

export function CampaignSummaryCard({
  job,
  candidateCount,
  tierStats,
  channels,
}: CampaignSummaryCardProps) {
  const enabledChannels = [];
  if (channels.email) enabledChannels.push(`Email (${channels.email.sequenceLength} steps)`);
  if (channels.sms) enabledChannels.push(`SMS (${channels.sms.sequenceLength} steps)`);
  if (channels.aiCall) enabledChannels.push(`AI Calls (Day ${channels.aiCall.callDay})`);
  if (channels.linkedin) enabledChannels.push("LinkedIn (Manual)");

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Campaign Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Job Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Job</span>
          </div>
          {job ? (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="font-medium text-foreground">{job.specialty || job.job_name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{job.facility_name} - {job.city}, {job.state}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {job.bill_rate && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>${job.bill_rate}/hr</span>
                  </div>
                )}
                {job.start_date && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(job.start_date), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No job selected</p>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Candidates Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Candidates
            </span>
            <Badge variant="secondary" className="font-mono">
              {candidateCount} selected
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-lg font-semibold text-primary">{tierStats.tier1}</p>
              <p className="text-xs text-muted-foreground">A-Tier</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-lg font-semibold text-foreground">{tierStats.tier2}</p>
              <p className="text-xs text-muted-foreground">B-Tier</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ready to contact:</span>
            <span className="text-green-400 font-medium">{tierStats.readyCount}</span>
          </div>
          {tierStats.needsEnrichment > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Needs enrichment:</span>
              <span className="text-yellow-400 font-medium">{tierStats.needsEnrichment}</span>
            </div>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Channels Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Channels</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledChannels.length > 0 ? (
              enabledChannels.map((channel, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {channel}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No channels configured</span>
            )}
          </div>
          {channels.schedule?.startDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Starting {format(new Date(channels.schedule.startDate), "MMM d, yyyy")} at {channels.schedule.sendWindowStart}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
