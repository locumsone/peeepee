import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Flame, Users, TrendingUp, Calendar, Target, UserCircle } from "lucide-react";
import { ExpandableJobRow } from "@/components/jobs";
import { useJobAssignments } from "@/hooks/useJobAssignments";
import { useAuth } from "@/hooks/useAuth";

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

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStats, setJobStats] = useState<Record<string, JobStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Fetch job assignments
  const jobIds = jobs.map(j => j.id);
  const { assignments, isLoading: assignmentsLoading, refetch: refetchAssignments, isAssignedToJob } = useJobAssignments(jobIds);

  useEffect(() => {
    fetchJobsWithStats();
  }, []);

  // Refetch assignments when jobs change
  useEffect(() => {
    if (jobIds.length > 0) {
      refetchAssignments();
    }
  }, [jobIds.join(",")]);

  const fetchJobsWithStats = async () => {
    setIsLoading(true);
    
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("id, job_name, facility_name, city, state, specialty, schedule, pay_rate, bill_rate, status, start_date, created_at")
        .order("created_at", { ascending: false });

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError);
        return;
      }

      setJobs(jobsData || []);

      // Fetch candidate_job_matches counts per job
      const { data: matchCounts } = await supabase
        .from("candidate_job_matches")
        .select("job_id");

      const matchCountByJob: Record<string, number> = {};
      if (matchCounts) {
        matchCounts.forEach(m => {
          if (m.job_id) {
            matchCountByJob[m.job_id] = (matchCountByJob[m.job_id] || 0) + 1;
          }
        });
      }

      // Fetch campaigns and leads for all jobs
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, job_id, status");

      if (!campaigns || campaigns.length === 0) {
        // Still set match counts even without campaigns
        const stats: Record<string, JobStats> = {};
        (jobsData || []).forEach(job => {
          if (matchCountByJob[job.id]) {
            stats[job.id] = {
              jobId: job.id,
              totalCandidates: 0,
              matchedCandidates: matchCountByJob[job.id] || 0,
              pipelineCounts: {},
              totalReplies: 0,
              hotLeads: 0,
              draftCandidates: 0,
            };
          }
        });
        setJobStats(stats);
        setIsLoading(false);
        return;
      }

      const campaignIdsByJob: Record<string, string[]> = {};
      const draftCampaignIdsByJob: Record<string, string[]> = {};
      
      campaigns.forEach(c => {
        if (c.job_id) {
          if (!campaignIdsByJob[c.job_id]) {
            campaignIdsByJob[c.job_id] = [];
          }
          campaignIdsByJob[c.job_id].push(c.id);
          
          // Track draft campaigns separately
          if (c.status === "draft") {
            if (!draftCampaignIdsByJob[c.job_id]) {
              draftCampaignIdsByJob[c.job_id] = [];
            }
            draftCampaignIdsByJob[c.job_id].push(c.id);
          }
        }
      });

      const allCampaignIds = campaigns.map(c => c.id);
      
      // Fetch leads for all campaigns
      const { data: leads } = await supabase
        .from("campaign_leads_v2")
        .select("campaign_id, status, emails_replied, sms_replied, interest_level, updated_at")
        .in("campaign_id", allCampaignIds);

      if (leads) {
        // Calculate stats per job
        const stats: Record<string, JobStats> = {};
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        Object.entries(campaignIdsByJob).forEach(([jobId, cIds]) => {
          const jobLeads = leads.filter(l => cIds.includes(l.campaign_id || ""));
          const draftCIds = draftCampaignIdsByJob[jobId] || [];
          const draftLeads = leads.filter(l => draftCIds.includes(l.campaign_id || "") && l.status === "draft");
          
          const pipelineCounts: Record<string, number> = {};
          let totalReplies = 0;
          let hotLeads = 0;

          jobLeads.forEach(lead => {
            // Don't count draft leads in pipeline
            if (lead.status === "draft") return;
            
            const status = lead.status || "sourced";
            pipelineCounts[status] = (pipelineCounts[status] || 0) + 1;
            
            const replies = (lead.emails_replied || 0) + (lead.sms_replied || 0);
            totalReplies += replies;

            // Hot lead = interested or engaged with recent activity
            if (
              lead.interest_level === "interested" ||
              (replies > 0 && lead.updated_at && new Date(lead.updated_at) > oneDayAgo)
            ) {
              hotLeads++;
            }
          });

          stats[jobId] = {
            jobId,
            totalCandidates: jobLeads.filter(l => l.status !== "draft").length,
            matchedCandidates: matchCountByJob[jobId] || 0,
            pipelineCounts,
            totalReplies,
            hotLeads,
            draftCandidates: draftLeads.length,
          };
        });

        // Add jobs that only have matches (no campaigns yet)
        (jobsData || []).forEach(job => {
          if (!stats[job.id] && matchCountByJob[job.id]) {
            stats[job.id] = {
              jobId: job.id,
              totalCandidates: 0,
              matchedCandidates: matchCountByJob[job.id] || 0,
              pipelineCounts: {},
              totalReplies: 0,
              hotLeads: 0,
              draftCandidates: 0,
            };
          }
        });

        setJobStats(stats);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "mine") {
      return isAssignedToJob(job.id);
    }
    if (filter === "hot") {
      const stats = jobStats[job.id];
      return stats && stats.hotLeads > 0;
    }
    if (filter === "no_outreach") {
      const stats = jobStats[job.id];
      return !stats || stats.totalCandidates === 0;
    }
    if (filter === "draft") {
      const stats = jobStats[job.id];
      return stats && stats.draftCandidates > 0;
    }
    return job.status === filter;
  });

  // Summary stats
  const activeJobs = jobs.filter(j => j.status === "active").length;
  const totalHotLeads = Object.values(jobStats).reduce((sum, s) => sum + s.hotLeads, 0);
  const totalCandidates = Object.values(jobStats).reduce((sum, s) => sum + s.totalCandidates, 0);
  const totalMatched = Object.values(jobStats).reduce((sum, s) => sum + s.matchedCandidates, 0);
  const myJobsCount = user ? jobs.filter(j => isAssignedToJob(j.id)).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
            <p className="text-muted-foreground mt-1">Manage your locum tenens positions</p>
          </div>
          <Button 
            onClick={() => navigate("/jobs/new")}
            variant="gradient"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{myJobsCount}</p>
                  <p className="text-xs text-muted-foreground">My Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{activeJobs}</p>
                  <p className="text-xs text-muted-foreground">Active Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalMatched}</p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalHotLeads}</p>
                  <p className="text-xs text-muted-foreground">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalCandidates}</p>
                  <p className="text-xs text-muted-foreground">In Pipeline</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine" className="flex items-center gap-1">
              <UserCircle className="h-3 w-3" />
              My Jobs
              {myJobsCount > 0 && (
                <span className="ml-1 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">
                  {myJobsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="hot" className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Hot Leads
            </TabsTrigger>
            <TabsTrigger value="draft">Has Drafts</TabsTrigger>
            <TabsTrigger value="no_outreach">Needs Outreach</TabsTrigger>
            <TabsTrigger value="on_hold">On Hold</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No jobs found</p>
          </div>
        )}

        {/* Jobs Grid - Using ExpandableJobRow */}
        {!isLoading && filteredJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => (
              <ExpandableJobRow 
                key={job.id} 
                job={job} 
                stats={jobStats[job.id]}
                assignments={assignments[job.id] || []}
                onAssignmentsUpdated={refetchAssignments}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
