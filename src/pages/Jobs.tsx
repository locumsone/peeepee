import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Calendar, ArrowRight, Building2, MapPin, Stethoscope, Clock, Flame, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { JobPipeline, JobReplyBadge } from "@/components/jobs";
import { cn } from "@/lib/utils";

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
  pipelineCounts: Record<string, number>;
  totalReplies: number;
  hotLeads: number;
}

const statusColors: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  on_hold: "bg-warning/20 text-warning border-warning/30",
  filled: "bg-accent/20 text-accent border-accent/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStats, setJobStats] = useState<Record<string, JobStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchJobsWithStats();
  }, []);

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

      // Fetch campaigns and leads for all jobs
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, job_id");

      if (!campaigns || campaigns.length === 0) {
        setIsLoading(false);
        return;
      }

      const campaignIdsByJob: Record<string, string[]> = {};
      campaigns.forEach(c => {
        if (c.job_id) {
          if (!campaignIdsByJob[c.job_id]) {
            campaignIdsByJob[c.job_id] = [];
          }
          campaignIdsByJob[c.job_id].push(c.id);
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
          
          const pipelineCounts: Record<string, number> = {};
          let totalReplies = 0;
          let hotLeads = 0;

          jobLeads.forEach(lead => {
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
            totalCandidates: jobLeads.length,
            pipelineCounts,
            totalReplies,
            hotLeads,
          };
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
    if (filter === "hot") {
      const stats = jobStats[job.id];
      return stats && stats.hotLeads > 0;
    }
    if (filter === "no_outreach") {
      const stats = jobStats[job.id];
      return !stats || stats.totalCandidates === 0;
    }
    return job.status === filter;
  });

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "MMM d, yyyy");
  };

  const calculateMargin = (billRate: number | null, payRate: number | null) => {
    if (!billRate || !payRate) return null;
    const malpractice = payRate * 0.10;
    return billRate - payRate - malpractice;
  };

  // Summary stats
  const activeJobs = jobs.filter(j => j.status === "active").length;
  const totalHotLeads = Object.values(jobStats).reduce((sum, s) => sum + s.hotLeads, 0);
  const totalCandidates = Object.values(jobStats).reduce((sum, s) => sum + s.totalCandidates, 0);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalCandidates}</p>
                  <p className="text-xs text-muted-foreground">Total Candidates</p>
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
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{jobs.length}</p>
                  <p className="text-xs text-muted-foreground">Total Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="hot" className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Hot Leads
            </TabsTrigger>
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

        {/* Jobs Grid */}
        {!isLoading && filteredJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => {
              const margin = calculateMargin(job.bill_rate, job.pay_rate);
              const stats = jobStats[job.id];
              
              return (
                <Card 
                  key={job.id} 
                  className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <CardHeader className="pb-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                            {job.job_name || "Untitled Job"}
                          </h3>
                          {stats && stats.hotLeads > 0 && (
                            <Flame className="h-4 w-4 text-orange-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
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

                    {/* Footer */}
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
