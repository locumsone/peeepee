import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Pencil, Users, Rocket, AlertTriangle, Settings, Activity, BarChart3, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  JobPipeline, 
  JobCandidateKanban, 
  JobActivityFeed, 
  JobOutreachStats,
  JobCandidateCard 
} from "@/components/jobs";
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
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("candidates");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  
  // Pipeline data
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
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

  const copyId = async () => {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    toast({ title: "Copied!", description: "Job ID copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-success text-success-foreground",
      on_hold: "bg-warning text-warning-foreground",
      filled: "bg-blue-500 text-white",
      closed: "bg-muted text-muted-foreground",
    };
    return styles[status] || "bg-muted text-muted-foreground";
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

  // Calculate pay breakdown
  const billRate = job?.bill_rate || 0;
  const payRate = billRate * 0.73;
  const malpractice = payRate * 0.10;
  const margin = billRate - (payRate * 1.10);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
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
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>

        {/* Header Card */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-secondary/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground font-display">
                  {job.job_name || "Untitled Job"}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{job.facility_name}</span>
                  <span>•</span>
                  <span>{job.city}, {job.state}</span>
                  <span>•</span>
                  <span className="text-success font-medium">${job.pay_rate || payRate.toFixed(0)}/hr</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {job.requisition_id && (
                    <Badge variant="outline" className="font-mono text-xs">
                      REQ #{job.requisition_id}
                    </Badge>
                  )}
                  <Badge className={cn("capitalize", getStatusBadge(job.status))}>
                    {job.status?.replace("_", " ") || "draft"}
                  </Badge>
                  {job.is_urgent && (
                    <Badge className="bg-destructive text-destructive-foreground">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      URGENT
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/candidates/search?jobId=${id}`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Find Candidates
                </Button>
                <Button 
                  variant="default"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => navigate(`/candidates/matching?jobId=${id}`)}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </div>
          </div>

          {/* Pipeline Summary */}
          <div className="p-6">
            <JobPipeline 
              counts={pipelineCounts} 
              onStageClick={(stageId) => {
                setActiveTab("candidates");
                // Could filter to specific stage
              }}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="candidates" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Candidates
                <Badge variant="secondary" className="ml-1">{leads.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="outreach" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Outreach
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {activeTab === "candidates" && (
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
            {leads.length === 0 ? (
              <div className="text-center py-16 rounded-lg border border-dashed border-border">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-foreground mb-2">No candidates yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a campaign to start adding candidates to this job
                </p>
                <Button onClick={() => navigate(`/candidates/matching?jobId=${id}`)}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Campaign
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
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
            <div className="rounded-lg border border-border bg-card p-6">
              <JobActivityFeed
                jobId={id || ""}
                campaignIds={campaignIds}
                candidateIds={leads.map(l => l.candidate_id).filter(Boolean) as string[]}
              />
            </div>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach" className="mt-4">
            <JobOutreachStats metrics={metrics} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Job Details */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 className="font-semibold text-foreground">Job Details</h2>
                </div>
                <div className="p-6">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border/50">
                      <TableRow 
                        label="Supabase ID" 
                        value={
                          <button
                            onClick={copyId}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group font-mono text-xs"
                          >
                            <span>{id}</span>
                            {copied ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                        }
                      />
                      <TableRow label="Specialty" value={job.specialty || "—"} />
                      <TableRow label="Schedule" value={job.schedule || "—"} />
                      <TableRow label="Start Date" value={formatDate(job.start_date)} />
                      {job.end_date && (
                        <TableRow label="End Date" value={formatDate(job.end_date)} />
                      )}
                      <TableRow 
                        label="Requirements" 
                        value={job.requirements || "No specific requirements listed"}
                        multiline
                      />
                      {job.client_contact && (
                        <TableRow label="Client Contact" value={job.client_contact} />
                      )}
                      {job.client_email && (
                        <TableRow label="Client Email" value={job.client_email} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pay Breakdown */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-success/10">
                  <h2 className="font-semibold text-success">Pay Breakdown</h2>
                </div>
                <div className="p-6">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border/50">
                      <tr>
                        <td className="py-3 text-muted-foreground w-40">Bill Rate</td>
                        <td className="py-3 text-foreground font-medium">
                          ${billRate.toFixed(0)}/hr
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 text-muted-foreground">Pay Rate</td>
                        <td className="py-3 text-success font-semibold">
                          ${payRate.toFixed(0)}/hr <span className="text-muted-foreground font-normal">(73%)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 text-muted-foreground">Malpractice</td>
                        <td className="py-3 text-foreground">
                          ${malpractice.toFixed(0)}/hr <span className="text-muted-foreground">(10%)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 text-muted-foreground">Margin</td>
                        <td className="py-3 text-foreground">
                          ${margin.toFixed(0)}/hr
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-border">
                  <Button variant="outline" onClick={() => navigate(`/edit-job/${id}`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Job
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

interface TableRowProps {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}

const TableRow = ({ label, value, multiline }: TableRowProps) => (
  <tr>
    <td className="py-3 text-muted-foreground w-40 align-top">{label}</td>
    <td className={cn("py-3 text-foreground", multiline && "whitespace-pre-wrap")}>
      {value}
    </td>
  </tr>
);

export default JobDetail;
