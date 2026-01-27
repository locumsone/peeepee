import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Stethoscope, FileText, DollarSign, Users, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Job {
  id: string;
  specialty?: string;
  schedule?: string;
  start_date?: string;
  end_date?: string;
  requirements?: string;
  bill_rate?: number;
  pay_rate?: number;
  created_by?: string;
  client_contact?: string;
  client_email?: string;
}

interface ActivityItem {
  id: string;
  type: string;
  content: string;
  candidateName: string | null;
  createdAt: string;
}

interface JobDetailSidebarProps {
  job: Job;
  campaignIds: string[];
  onViewAllActivity: () => void;
}

export const JobDetailSidebar = ({ job, campaignIds, onViewAllActivity }: JobDetailSidebarProps) => {
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, [campaignIds]);

  const fetchRecentActivity = async () => {
    if (campaignIds.length === 0) {
      setRecentActivity([]);
      setIsLoadingActivity(false);
      return;
    }

    setIsLoadingActivity(true);
    try {
      const { data: smsData } = await supabase
        .from("sms_messages")
        .select(`
          id,
          body,
          direction,
          created_at,
          conversation:sms_conversations!inner(
            campaign_id,
            contact_name
          )
        `)
        .in("conversation.campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(5);

      const activities: ActivityItem[] = [];
      
      if (smsData) {
        smsData.forEach((msg: any) => {
          activities.push({
            id: `sms-${msg.id}`,
            type: msg.direction === "inbound" ? "reply" : "sms",
            content: msg.body?.substring(0, 50) + (msg.body?.length > 50 ? "..." : "") || "",
            candidateName: msg.conversation?.contact_name || null,
            createdAt: msg.created_at,
          });
        });
      }

      activities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRecentActivity(activities.slice(0, 3));
    } catch (err) {
      console.error("Error fetching recent activity:", err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const billRate = job.bill_rate || 0;
  const payRate = job.pay_rate || billRate * 0.73;
  const margin = billRate - payRate;
  const marginPercent = billRate > 0 ? ((margin / billRate) * 100).toFixed(0) : 0;

  return (
    <div className="space-y-4">
      {/* Job Requirements Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Job Details
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <DetailRow icon={Stethoscope} label="Specialty" value={job.specialty || "—"} />
          <DetailRow icon={Clock} label="Schedule" value={job.schedule || "—"} />
          <DetailRow icon={Calendar} label="Start Date" value={formatDate(job.start_date)} />
          {job.end_date && (
            <DetailRow icon={Calendar} label="End Date" value={formatDate(job.end_date)} />
          )}
          
          {job.requirements && (
            <Collapsible open={requirementsExpanded} onOpenChange={setRequirementsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between px-0 hover:bg-transparent">
                  <span className="text-sm text-muted-foreground">Requirements</span>
                  {requirementsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 mt-2">
                  {job.requirements}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Pay Breakdown Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-success/10">
          <h3 className="font-semibold text-sm text-success flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pay Breakdown
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Bill Rate</span>
            <span className="font-semibold text-foreground">${billRate.toFixed(0)}/hr</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Pay Rate</span>
            <span className="font-semibold text-success">${payRate.toFixed(0)}/hr</span>
          </div>
          
          {/* Visual margin bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Margin</span>
              <span>${margin.toFixed(0)}/hr ({marginPercent}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-success to-success/60 transition-all"
                style={{ width: `${marginPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hiring Team Card */}
      {(job.client_contact || job.created_by) && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Hiring Team
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {job.client_contact && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {job.client_contact.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{job.client_contact}</div>
                  <div className="text-xs text-muted-foreground">Client Contact</div>
                </div>
              </div>
            )}
            {job.client_email && (
              <div className="text-xs text-muted-foreground pl-11">
                {job.client_email}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          {isLoadingActivity ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(activity => (
                <div key={activity.id} className="flex items-start gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full mt-1.5 flex-shrink-0",
                    activity.type === "reply" ? "bg-success" : "bg-primary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {activity.candidateName || "Unknown"}: {activity.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={onViewAllActivity}
          >
            View All Activity
          </Button>
        </div>
      </div>
    </div>
  );
};

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

const DetailRow = ({ icon: Icon, label, value }: DetailRowProps) => (
  <div className="flex items-center gap-3">
    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    <div className="flex-1 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  </div>
);

export default JobDetailSidebar;
