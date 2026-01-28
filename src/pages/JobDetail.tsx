import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, Activity, BarChart3, Star, FileText, LayoutGrid, List, UserCheck, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { differenceInDays } from "date-fns";
import { 
  JobPipeline, 
  JobCandidateKanban, 
  JobActivityFeed, 
  JobOutreachStats,
  JobCandidateCard,
  JobDetailHeader,
  JobQuickStats,
  JobQuickActions,
  JobDetailSidebar,
  JobScorecard,
  JobNotesPanel,
  MatchedCandidatesGrid,
} from "@/components/jobs";
import { MatchedCandidate } from "@/components/jobs/MatchedCandidateCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Job {
  id: string;
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  specialty: string;
  schedule: string;
  start_date: string;
  end_date: string;
  requirements: string;
  bill_rate: number;
  pay_rate: number;
  status: string;
  is_urgent?: boolean;
  requisition_id?: string;
  client_contact?: string;
  client_email?: string;
  created_at?: string;
  created_by?: string;
}

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

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("candidates");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [candidateView, setCandidateView] = useState<"matched" | "pipeline">("matched");
  
  // Pipeline data
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  
  // Matched candidates data
  const [matchedCandidates, setMatchedCandidates] = useState<MatchedCandidate[]>([]);
  const [isLoadingMatched, setIsLoadingMatched] = useState(false);
  
  // Stats for quick view
  const [matchedCount, setMatchedCount] = useState(0);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    emailsSent: 0,
    emailsOpened: 0,
    emailsReplied: 0,
    smsSent: 0,
    smsReplied: 0,
    callsAttempted: 0,
    callsConnected: 0,
  });

  useEffect(() => {
    if (id) {
      fetchJobData();
    }
  }, [id]);

  const fetchJobData = async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      // Fetch job
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch matched candidates count
      const { count: matchCount } = await supabase
        .from("candidate_job_matches")
        .select("*", { count: "exact", head: true })
        .eq("job_id", id);
      
      setMatchedCount(matchCount || 0);

      // Fetch campaigns for this job
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id")
        .eq("job_id", id);

      const cIds = campaigns?.map(c => c.id) || [];
      setCampaignIds(cIds);

      if (cIds.length > 0) {
        // Fetch leads for these campaigns
        const { data: leadsData } = await supabase
          .from("campaign_leads_v2")
          .select("*")
          .in("campaign_id", cIds)
          .order("updated_at", { ascending: false });

        if (leadsData) {
          setLeads(leadsData);
          
          // Calculate pipeline counts
          const counts: Record<string, number> = {};
          leadsData.forEach(lead => {
            const status = lead.status || "sourced";
            counts[status] = (counts[status] || 0) + 1;
          });
          setPipelineCounts(counts);

          // Calculate metrics
          const m = {
            totalLeads: leadsData.length,
            emailsSent: leadsData.reduce((sum, l) => sum + (l.emails_sent || 0), 0),
            emailsOpened: leadsData.reduce((sum, l) => sum + (l.emails_opened || 0), 0),
            emailsReplied: leadsData.reduce((sum, l) => sum + (l.emails_replied || 0), 0),
            smsSent: leadsData.reduce((sum, l) => sum + (l.sms_sent || 0), 0),
            smsReplied: leadsData.reduce((sum, l) => sum + (l.sms_replied || 0), 0),
            callsAttempted: leadsData.reduce((sum, l) => sum + (l.calls_attempted || 0), 0),
            callsConnected: leadsData.reduce((sum, l) => sum + (l.calls_connected || 0), 0),
          };
          setMetrics(m);
        }
      }

      // Auto-load matched candidates
      await fetchMatchedCandidates(id);
    } catch (err) {
      console.error("Error fetching job:", err);
      toast({
        title: "Error",
        description: "Failed to load job details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatchedCandidates = async (jobId: string) => {
    setIsLoadingMatched(true);
    try {
      // Fetch matched candidates with their full profile data
      const { data: matches, error } = await supabase
        .from("candidate_job_matches")
        .select(`
          match_score,
          match_reasons,
          match_concerns,
          created_at,
          candidate_id,
          candidates (
            id,
            first_name,
            last_name,
            email,
            phone,
            specialty,
            state,
            licenses,
            board_certified
          )
        `)
        .eq("job_id", jobId)
        .order("match_score", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Transform the data
      const transformedCandidates: MatchedCandidate[] = (matches || [])
        .filter((m: any) => m.candidates)
        .map((m: any) => ({
          id: m.candidates.id,
          first_name: m.candidates.first_name,
          last_name: m.candidates.last_name,
          email: m.candidates.email,
          phone: m.candidates.phone,
          specialty: m.candidates.specialty,
          state: m.candidates.state,
          licenses: m.candidates.licenses,
          board_certified: m.candidates.board_certified,
          match_score: m.match_score,
          match_reasons: m.match_reasons,
          match_concerns: m.match_concerns,
          matched_at: m.created_at,
        }));

      setMatchedCandidates(transformedCandidates);
    } catch (err) {
      console.error("Error fetching matched candidates:", err);
    } finally {
      setIsLoadingMatched(false);
    }
  };

  const handleStatusChange = useCallback((leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => 
      l.id === leadId ? { ...l, status: newStatus } : l
    ));
    // Recalculate pipeline counts
    setPipelineCounts(prev => {
      const updated = { ...prev };
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        const oldStatus = lead.status || "sourced";
        updated[oldStatus] = (updated[oldStatus] || 1) - 1;
        updated[newStatus] = (updated[newStatus] || 0) + 1;
      }
      return updated;
    });
  }, [leads]);

  const handleAddToCampaign = (candidateId: string) => {
    // Navigate to campaign builder with this candidate pre-selected
    navigate(`/candidates/matching?jobId=${id}&candidateId=${candidateId}`);
  };

  // Calculate health score
  const calculateHealthScore = (): number => {
    if (!job) return 0;
    
    const daysOpen = job.created_at 
      ? differenceInDays(new Date(), new Date(job.created_at))
      : 0;
    
    let score = 100;
    
    // Deduct for days open
    if (daysOpen > 7) score -= 5;
    if (daysOpen > 14) score -= 10;
    if (daysOpen > 30) score -= 15;
    if (daysOpen > 60) score -= 20;
    
    // Deduct for no activity
    if (metrics.totalLeads === 0 && matchedCount === 0) score -= 20;
    
    // Boost for responses
    const totalReplies = metrics.emailsReplied + metrics.smsReplied;
    if (totalReplies > 0) score += 10;
    if (totalReplies > 5) score += 10;
    
    // Boost for interested candidates
    const interested = pipelineCounts.interested || 0;
    if (interested > 0) score += 10;
    if (interested > 3) score += 10;

    // Boost for matched candidates
    if (matchedCount > 10) score += 5;
    if (matchedCount > 30) score += 5;
    
    return Math.max(0, Math.min(100, score));
  };

  const daysOpen = job?.created_at 
    ? differenceInDays(new Date(), new Date(job.created_at))
    : 0;
    
  const totalReplies = metrics.emailsReplied + metrics.smsReplied;
  const healthScore = calculateHealthScore();

  // Prepare scorecard candidates - use matched if no pipeline leads
  const scorecardCandidates = leads.length > 0 
    ? leads 
    : matchedCandidates.map(c => ({
        id: c.id,
        candidate_id: c.id,
        candidate_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || null,
        candidate_specialty: c.specialty,
        candidate_state: c.state,
        status: null,
        tier: null,
      }));

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl text-center py-20">
          <h1 className="text-2xl font-bold text-foreground mb-4">Job Not Found</h1>
          <Button variant="outline" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <JobDetailHeader job={job} />

        {/* Quick Stats */}
        <JobQuickStats
          matchedCount={matchedCount}
          pipelineCount={metrics.totalLeads}
          totalReplies={totalReplies}
          daysOpen={daysOpen}
          healthScore={healthScore}
        />

        {/* Quick Actions */}
        <JobQuickActions 
          jobId={job.id} 
          jobName={job.job_name} 
          onRefresh={fetchJobData}
        />

        {/* Pipeline */}
        <div className="rounded-xl border border-border bg-card p-6">
          <JobPipeline 
            counts={pipelineCounts} 
            onStageClick={(stageId) => {
              setActiveTab("candidates");
              setCandidateView("pipeline");
            }}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Main Content - Tabs */}
          <div className="min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="candidates" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Candidates
                    <Badge variant="secondary" className="ml-1">
                      {matchedCount + leads.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="outreach" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Outreach
                  </TabsTrigger>
                  <TabsTrigger value="scorecards" className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Scorecards
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                {activeTab === "candidates" && candidateView === "pipeline" && leads.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === "kanban" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("kanban")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Candidates Tab */}
              <TabsContent value="candidates" className="mt-4">
                {/* Sub-tabs for Matched vs Pipeline */}
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant={candidateView === "matched" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateView("matched")}
                    className="flex items-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    Matched
                    <Badge variant="secondary" className="ml-1">{matchedCount}</Badge>
                  </Button>
                  <Button
                    variant={candidateView === "pipeline" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateView("pipeline")}
                    className="flex items-center gap-2"
                  >
                    <GitBranch className="h-4 w-4" />
                    In Pipeline
                    <Badge variant="secondary" className="ml-1">{leads.length}</Badge>
                  </Button>
                </div>

                {candidateView === "matched" ? (
                  <MatchedCandidatesGrid
                    candidates={matchedCandidates}
                    requiredState={job.state}
                    onAddToCampaign={handleAddToCampaign}
                    isLoading={isLoadingMatched}
                  />
                ) : leads.length === 0 ? (
                  <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No candidates in pipeline</h3>
                    <p className="text-muted-foreground mb-4">
                      {matchedCount > 0 
                        ? "Add matched candidates to a campaign to start outreach"
                        : "Create a campaign to start adding candidates to this job"}
                    </p>
                    <Button onClick={() => navigate(`/candidates/matching?jobId=${id}`)}>
                      {matchedCount > 0 ? "Create Campaign" : "Find Candidates"}
                    </Button>
                  </div>
                ) : viewMode === "kanban" ? (
                  <JobCandidateKanban
                    leads={leads}
                    onStatusChange={handleStatusChange}
                    onCall={(lead) => navigate(`/communications?phone=${lead.candidate_phone}`)}
                    onSMS={(lead) => navigate(`/communications?phone=${lead.candidate_phone}`)}
                  />
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                      {leads.map((lead) => (
                        <JobCandidateCard
                          key={lead.id}
                          lead={lead}
                          onCall={(l) => navigate(`/communications?phone=${l.candidate_phone}`)}
                          onSMS={(l) => navigate(`/communications?phone=${l.candidate_phone}`)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                <div className="rounded-xl border border-border bg-card p-6">
                  <JobActivityFeed
                    jobId={id || ""}
                    campaignIds={campaignIds}
                    candidateIds={[
                      ...leads.map(l => l.candidate_id).filter(Boolean) as string[],
                      ...matchedCandidates.map(c => c.id)
                    ]}
                  />
                </div>
              </TabsContent>

              {/* Outreach Tab */}
              <TabsContent value="outreach" className="mt-4">
                <JobOutreachStats metrics={metrics} />
              </TabsContent>

              {/* Scorecards Tab */}
              <TabsContent value="scorecards" className="mt-4">
                <div className="rounded-xl border border-border bg-card p-6">
                  <JobScorecard
                    jobId={id || ""}
                    leads={scorecardCandidates}
                    requiredState={job.state}
                    requiredSpecialty={job.specialty}
                  />
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-4">
                <div className="rounded-xl border border-border bg-card p-6">
                  <JobNotesPanel jobId={id || ""} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-6 h-fit">
            <JobDetailSidebar 
              job={job} 
              campaignIds={campaignIds}
              onViewAllActivity={() => setActiveTab("activity")}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default JobDetail;
