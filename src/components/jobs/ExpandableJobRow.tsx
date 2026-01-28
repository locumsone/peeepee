import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, ChevronUp, Calendar, ArrowRight, Building2, MapPin, 
  Stethoscope, Clock, Flame, Users, Target, MessageSquare, UserPlus 
} from "lucide-react";
import { format } from "date-fns";
import { JobPipeline, JobReplyBadge, TeamMemberAvatars, JobAssignmentDialog } from "@/components/jobs";
import JobQuickActivity from "./JobQuickActivity";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Job {
  id: string;
  job_name: string | null;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  schedule: string | null;
  pay_rate: number | null;
  bill_rate: number | null;
  status: string | null;
  start_date: string | null;
  created_at: string | null;
}

interface JobStats {
  jobId: string;
  totalCandidates: number;
  matchedCandidates: number;
  pipelineCounts: Record<string, number>;
  totalReplies: number;
  hotLeads: number;
  draftCandidates: number;
}

interface JobAssignment {
  id: string;
  job_id: string;
  user_id: string;
  role: "primary" | "support";
  assigned_at: string;
  users?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface ExpandableJobRowProps {
  job: Job;
  stats: JobStats | undefined;
  assignments?: JobAssignment[];
  onAssignmentsUpdated?: () => void;
}

const statusColors: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  on_hold: "bg-warning/20 text-warning border-warning/30",
  filled: "bg-accent/20 text-accent border-accent/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export const ExpandableJobRow = ({ job, stats, assignments = [], onAssignmentsUpdated }: ExpandableJobRowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "MMM d, yyyy");
  };

  const calculateMargin = (billRate: number | null, payRate: number | null) => {
    if (!billRate || !payRate) return null;
    const malpractice = payRate * 0.10;
    return billRate - payRate - malpractice;
  };

  const margin = calculateMargin(job.bill_rate, job.pay_rate);
  const matchedCount = stats?.matchedCandidates || 0;
  const pipelineCount = stats?.totalCandidates || 0;
  const draftCount = stats?.draftCandidates || 0;

  // Check if current user is assigned
  const isAssigned = user ? assignments.some(a => a.user_id === user.id) : false;

  const handleJoinJob = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    setIsJoining(true);
    try {
      const { error } = await supabase
        .from("job_assignments")
        .insert({
          job_id: job.id,
          user_id: user.id,
          role: "support",
          assigned_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Joined Job",
        description: `You're now working on ${job.job_name || "this job"}`,
      });

      onAssignmentsUpdated?.();
    } catch (err) {
      console.error("Error joining job:", err);
      toast({
        title: "Error",
        description: "Failed to join job",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className={cn(
          "bg-card border-border transition-all",
          isExpanded ? "border-primary/50 shadow-glow" : "hover:border-primary/30"
        )}>
          <CardHeader className="pb-3">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 
                    className="text-lg font-semibold text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    {job.job_name || "Untitled Job"}
                  </h3>
                  {stats && stats.hotLeads > 0 && (
                    <Flame className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Team Member Avatars */}
                {assignments.length > 0 && (
                  <div 
                    className="cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAssignDialogOpen(true);
                    }}
                  >
                    <TeamMemberAvatars assignments={assignments} size="sm" maxVisible={3} />
                  </div>
                )}
                
                {/* Join button if not assigned */}
                {!isAssigned && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleJoinJob}
                    disabled={isJoining}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Join
                  </Button>
                )}

                <Badge 
                  variant="outline" 
                  className={statusColors[job.status || "closed"]}
                >
                  {job.status?.replace("_", " ") || "unknown"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Info Grid 2x2 */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{job.facility_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {job.city && job.state 
                    ? `${job.city}, ${job.state}` 
                    : job.state || job.city || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Stethoscope className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{job.specialty || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{job.schedule || "—"}</span>
              </div>
            </div>

            {/* Candidate Counts Summary */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-foreground font-medium">{matchedCount}</span>
                <span className="text-muted-foreground">Matched</span>
              </div>
              <span className="text-muted-foreground">·</span>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-success" />
                <span className="text-foreground font-medium">{pipelineCount}</span>
                <span className="text-muted-foreground">In Pipeline</span>
              </div>
              {draftCount > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-warning" />
                    <span className="text-foreground font-medium">{draftCount}</span>
                    <span className="text-muted-foreground">Draft</span>
                  </div>
                </>
              )}
            </div>

            {/* Pipeline Progress */}
            {stats && stats.totalCandidates > 0 && (
              <JobPipeline counts={stats.pipelineCounts} compact />
            )}

            {/* Reply Badges */}
            {stats && (
              <JobReplyBadge 
                totalReplies={stats.totalReplies}
                hotLeads={stats.hotLeads}
              />
            )}

            {/* Pay Section */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Bill Rate:</span>
                <span className="text-sm text-muted-foreground">
                  {job.bill_rate ? `$${job.bill_rate}/hr` : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">Pay Rate:</span>
                <span className="text-2xl font-bold text-success">
                  {job.pay_rate ? `$${job.pay_rate}/hr` : "—"}
                </span>
              </div>
              {margin !== null && (
                <div className="text-xs text-muted-foreground text-right">
                  ~${margin.toFixed(0)}/hr margin
                </div>
              )}
            </div>

            {/* Expand Trigger */}
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span>{isExpanded ? "Hide Details" : "Show Details"}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>

            {/* Expanded Content */}
            <CollapsibleContent className="space-y-4">
              {/* Full Pipeline View */}
              {stats && stats.totalCandidates > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Pipeline Stages</h4>
                  <JobPipeline 
                    counts={stats.pipelineCounts} 
                    compact={false}
                    onStageClick={(stageId) => navigate(`/jobs/${job.id}?stage=${stageId}`)}
                  />
                </div>
              )}

              {/* Recent Activity */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h4>
                <JobQuickActivity jobId={job.id} limit={5} />
              </div>

              {/* Quick Actions */}
              <div className="border-t border-border pt-4 flex items-center gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  View Full Details
                </Button>
                <Button 
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/campaigns/new?jobId=${job.id}`)}
                >
                  Create Campaign
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CollapsibleContent>

            {/* Footer (when collapsed) */}
            {!isExpanded && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{job.start_date ? formatDate(job.start_date) : "No start date"}</span>
                </div>
                <Button 
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/campaigns/new?jobId=${job.id}`);
                  }}
                >
                  Start Campaign
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Collapsible>

      {/* Assignment Dialog */}
      <JobAssignmentDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        jobId={job.id}
        jobName={job.job_name || "Untitled Job"}
        currentAssignments={assignments.map(a => ({ user_id: a.user_id, role: a.role }))}
        onAssignmentsUpdated={() => {
          onAssignmentsUpdated?.();
        }}
      />
    </>
  );
};

export default ExpandableJobRow;
