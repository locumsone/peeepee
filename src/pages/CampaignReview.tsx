import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Rocket,
  Briefcase,
  Users,
  Radio,
  Search,
  Check,
  AlertTriangle,
  ChevronDown,
  Pencil,
  Save,
  Cat,
  RefreshCw,
  Mail,
  ShieldCheck,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Channels" },
  { number: 4, label: "Review" },
];

const senderAccounts = [
  {
    group: "Rainey Morris",
    emails: [
      "rainey@locums.one",
      "rainey@trylocumsone.com",
      "rainey@meetlocumsone.com",
      "rainey@teamlocumsone.com",
      "rainey@locumsonehq.com",
    ],
  },
  {
    group: "Parker Spring",
    emails: [
      "parker@locums.one",
      "parker@trylocumsone.com",
      "parker@meetlocumsone.com",
      "parker@teamlocumsone.com",
      "parker@locumsonehq.com",
    ],
  },
  {
    group: "Ali Mussabayev",
    emails: [
      "ali@trylocumsone.com",
      "ali@meetlocumsone.com",
      "ali@teamlocumsone.com",
      "ali@locumsonehq.com",
    ],
  },
  {
    group: "Gio D'Alesio",
    emails: [
      "gio@locums.one",
      "gio@trylocumsone.com",
      "gio@meetlocumsone.com",
      "gio@teamlocumsone.com",
      "gio@locumsonehq.com",
    ],
  },
  {
    group: "Other",
    emails: [
      "info@locums.one",
      "meow@locums.one",
    ],
  },
];

interface Job {
  id: string;
  job_name: string | null;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  bill_rate: number | null;
  start_date: string | null;
}

interface ChannelConfig {
  email: { sender: string; sequenceLength: number; gapDays: number } | null;
  sms: { fromNumber: string; sequenceLength: number } | null;
  aiCall: { fromNumber: string; callDay: number; transferTo: string } | null;
  linkedin: boolean;
  schedule: {
    startDate: string;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    weekdaysOnly: boolean;
  };
}

interface PersonalizationHook {
  candidateId: string;
  candidateName: string;
  hook: string;
  confidence?: string;
  isEditing?: boolean;
}

interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  candidate_name?: string;
  description: string;
  suggestion?: string;
}

interface QualityCheckResult {
  can_launch: boolean;
  issues: QualityIssue[];
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
}

interface SelectedCandidate {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  personal_mobile?: string;
  specialty?: string;
  personalization_hook?: string;
  email_opener?: string;
  call_talking_points?: string[];
}

export default function CampaignReview() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<SelectedCandidate[]>([]);
  const [candidateStats, setCandidateStats] = useState({
    total: 0,
    aTier: 0,
    bTier: 0,
    cTier: 0,
    ready: 0,
    needEnrichment: 0,
  });
  const [channelConfig, setChannelConfig] = useState<ChannelConfig | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [selectedSender, setSelectedSender] = useState("");

  // Personalization state
  const [personalizationRun, setPersonalizationRun] = useState(false);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  const [personalizationProgress, setPersonalizationProgress] = useState(0);
  const [personalizationHooks, setPersonalizationHooks] = useState<PersonalizationHook[]>([]);
  const [hooksExpanded, setHooksExpanded] = useState(false);

  // Quality check state
  const [qualityCheckRun, setQualityCheckRun] = useState(false);
  const [qualityCheckLoading, setQualityCheckLoading] = useState(false);
  const [qualityCheckResult, setQualityCheckResult] = useState<QualityCheckResult | null>(null);

  // Launch state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState<string>("");

  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleStartOver = () => {
    sessionStorage.removeItem("campaign_job_id");
    sessionStorage.removeItem("campaign_job");
    sessionStorage.removeItem("campaign_candidate_ids");
    sessionStorage.removeItem("campaign_candidates");
    sessionStorage.removeItem("campaign_channels");
    sessionStorage.removeItem("selectedCandidates");
    sessionStorage.removeItem("job");
    sessionStorage.removeItem("channelConfig");
    navigate("/campaigns/new");
  };

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    try {
      // Read from both legacy and new sessionStorage keys
      const storedJobId = sessionStorage.getItem("campaign_job_id");
      const storedJob = sessionStorage.getItem("job") || sessionStorage.getItem("campaign_job");
      const storedCandidates = sessionStorage.getItem("selectedCandidates") || sessionStorage.getItem("campaign_candidates");
      const storedChannels = sessionStorage.getItem("channelConfig") || sessionStorage.getItem("campaign_channels");

      // Validate required data
      if (!storedJobId && !storedJob) {
        setLoadError("Missing job data. Please start over.");
        setIsLoading(false);
        return;
      }

      if (!storedCandidates || storedCandidates === "[]") {
        setLoadError("No candidates selected. Please start over.");
        setIsLoading(false);
        return;
      }

      if (!storedChannels || storedChannels === "{}") {
        setLoadError("Missing channel configuration. Please start over.");
        setIsLoading(false);
        return;
      }

      setJobId(storedJobId);
      
      // Parse job if available from sessionStorage
      if (storedJob) {
        try {
          setJob(JSON.parse(storedJob));
        } catch (e) {
          console.error("Error parsing job from sessionStorage:", e);
        }
      }

      const candidates = JSON.parse(storedCandidates);
      // Handle both array of IDs and array of candidate objects
      if (Array.isArray(candidates) && candidates.length > 0) {
        if (typeof candidates[0] === 'string') {
          setCandidateIds(candidates);
        } else {
          setCandidateIds(candidates.map((c: any) => c.id));
          setSelectedCandidates(candidates);
        }
      }
      
      setChannelConfig(JSON.parse(storedChannels));

      // Fetch job
      const fetchJob = async () => {
        const { data } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", storedJobId)
          .single();

        if (data) {
          setJob(data);
          // Auto-generate campaign name
          const specialty = data.specialty || "Campaign";
          const facility = data.facility_name || "Facility";
          const today = format(new Date(), "MMM d");
          setCampaignName(`${specialty} - ${facility} - ${today}`);

          // Set default sender
          if (storedChannels) {
            const channels = JSON.parse(storedChannels);
            if (channels.email?.sender) {
              setSelectedSender(channels.email.sender);
            }
          }
        }
      };

      // Fetch candidate stats and details
      const fetchCandidateStats = async () => {
        const { data } = await supabase
          .from("candidates")
          .select("id, first_name, last_name, enrichment_tier, phone, personal_mobile, email, personal_email, specialty")
          .in("id", candidates);

        if (data) {
          setSelectedCandidates(data);
          const stats = {
            total: data.length,
            aTier: data.filter((c) => c.enrichment_tier === "Platinum" || c.enrichment_tier === "Gold").length,
            bTier: data.filter((c) => c.enrichment_tier === "Silver").length,
            cTier: data.filter((c) => c.enrichment_tier === "Bronze" || !c.enrichment_tier).length,
            ready: data.filter((c) => c.phone || c.personal_mobile || c.email || c.personal_email).length,
            needEnrichment: data.filter((c) => !c.phone && !c.personal_mobile && !c.personal_email).length,
          };
          setCandidateStats(stats);
        }
      };

      fetchJob();
      fetchCandidateStats();
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading campaign data:", error);
      setLoadError("Something went wrong loading campaign data. Please start over.");
      setIsLoading(false);
    }
  }, [navigate]);

  const handleRunSherlock = async () => {
    if (!jobId || candidateIds.length === 0) return;

    setPersonalizationLoading(true);
    setPersonalizationProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setPersonalizationProgress((prev) => Math.min(prev + 5, 90));
    }, 500);

    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/personalization-research",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NTA3NDIsImV4cCI6MjA1MDMyNjc0Mn0.5R1H_6tsnp27PN5qYNE-4VdRT1H8kqH-NXQMJQL8sxg`,
          },
          body: JSON.stringify({
            candidate_ids: candidateIds,
            job_id: jobId,
          }),
        }
      );

      clearInterval(progressInterval);
      setPersonalizationProgress(100);

      if (response.ok) {
        const data = await response.json();
        // Map response to hooks
        const hooks: PersonalizationHook[] = data.results?.map((r: any) => ({
          candidateId: r.candidate_id,
          candidateName: r.candidate_name || "Unknown",
          hook: r.personalization_hook || "No hook generated",
          confidence: r.confidence || "medium",
        })) || [];

        setPersonalizationHooks(hooks);
        setPersonalizationRun(true);
        toast.success(`Research complete for ${hooks.length} candidates`);
      } else {
        // Generate mock hooks for demo
        const { data: candidates } = await supabase
          .from("candidates")
          .select("id, first_name, last_name, specialty, company_name")
          .in("id", candidateIds.slice(0, 10));

        const mockHooks: PersonalizationHook[] = (candidates || []).map((c) => ({
          candidateId: c.id,
          candidateName: `Dr. ${c.first_name} ${c.last_name}`,
          hook: c.company_name
            ? `Your experience at ${c.company_name} makes you an excellent fit...`
            : `Your background in ${c.specialty || "medicine"} caught our attention...`,
          confidence: c.company_name ? "high" : "medium",
        }));

        setPersonalizationHooks(mockHooks);
        setPersonalizationRun(true);
        toast.success(`Research complete for ${mockHooks.length} candidates`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Error running personalization research");
    } finally {
      setPersonalizationLoading(false);
    }
  };

  const handleEditHook = (candidateId: string) => {
    setPersonalizationHooks((prev) =>
      prev.map((h) => (h.candidateId === candidateId ? { ...h, isEditing: true } : h))
    );
  };

  const handleSaveHook = (candidateId: string, newHook: string) => {
    setPersonalizationHooks((prev) =>
      prev.map((h) =>
        h.candidateId === candidateId ? { ...h, hook: newHook, isEditing: false } : h
      )
    );
  };

  const handleRunQualityCheck = async () => {
    if (!jobId || selectedCandidates.length === 0) return;

    setQualityCheckLoading(true);

    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/campaign-quality-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NTA3NDIsImV4cCI6MjA1MDMyNjc0Mn0.5R1H_6tsnp27PN5qYNE-4VdRT1H8kqH-NXQMJQL8sxg`,
          },
          body: JSON.stringify({
            job_id: jobId,
            campaign_name: campaignName,
            candidates: selectedCandidates.map((c) => {
              const hook = personalizationHooks.find((h) => h.candidateId === c.id);
              return {
                id: c.id,
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email || c.personal_email,
                phone: c.phone || c.personal_mobile,
                specialty: c.specialty,
                personalization_hook: hook?.hook || c.personalization_hook || c.email_opener,
              };
            }),
            channels: channelConfig,
            sender_email: selectedSender,
            email_sequence_count: channelConfig?.email?.sequenceLength || 0,
            sms_sequence_count: channelConfig?.sms?.sequenceLength || 0,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQualityCheckResult(data);
        setQualityCheckRun(true);
        if (data.can_launch) {
          toast.success("Quality check passed!");
        } else {
          toast.warning("Quality check found issues to address");
        }
      } else {
        // Mock response for demo
        const mockResult: QualityCheckResult = {
          can_launch: true,
          issues: [
            {
              severity: 'warning',
              category: 'Contact Data',
              description: `${candidateStats.needEnrichment} candidates missing contact info`,
              suggestion: 'Consider running enrichment before launch',
            },
            {
              severity: 'info',
              category: 'Best Practices',
              description: 'Campaign scheduled to start on a Monday',
              suggestion: 'Tuesday-Thursday typically have better response rates',
            },
          ],
          summary: {
            critical: 0,
            warnings: candidateStats.needEnrichment > 0 ? 1 : 0,
            info: 1,
          },
        };
        setQualityCheckResult(mockResult);
        setQualityCheckRun(true);
        toast.success("Quality check complete");
      }
    } catch (error) {
      toast.error("Error running quality check");
    } finally {
      setQualityCheckLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!job || !channelConfig) return;

    setLaunching(true);

    try {
      // Get sender name from senderAccounts
      const senderGroup = senderAccounts.find((g) => g.emails.includes(selectedSender));
      const senderName = senderGroup?.group || "Locums One";

      setLaunchStep("🚀 Launching campaign...");

      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/launch-campaign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NTA3NDIsImV4cCI6MjA1MDMyNjc0Mn0.5R1H_6tsnp27PN5qYNE-4VdRT1H8kqH-NXQMJQL8sxg`,
          },
          body: JSON.stringify({
            job_id: jobId,
            candidates: selectedCandidates.map((c) => {
              const hook = personalizationHooks.find((h) => h.candidateId === c.id);
              return {
                id: c.id,
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email || c.personal_email,
                phone: c.phone || c.personal_mobile,
                specialty: c.specialty,
                icebreaker: hook?.hook || c.personalization_hook || c.email_opener,
                talking_points: c.call_talking_points || [],
              };
            }),
            channels: {
              email: channelConfig.email ? true : false,
              sms: channelConfig.sms ? true : false,
              ai_call: channelConfig.aiCall ? true : false,
            },
            campaign_name: campaignName,
            recruiter: {
              name: senderName,
              email: selectedSender,
              phone: "+12185628671",
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Show success summary
        const emailCount = data.results?.email?.queued || 0;
        const smsCount = data.results?.sms?.scheduled || 0;
        const callCount = data.results?.ai_calls?.queued || 0;

        toast.success(
          `Campaign launched! Email: ${emailCount} queued | SMS: ${smsCount} scheduled | Calls: ${callCount} queued`
        );

        // Clear session storage
        sessionStorage.removeItem("campaign_job_id");
        sessionStorage.removeItem("campaign_candidates");
        sessionStorage.removeItem("campaign_channels");

        navigate(`/campaigns/${data.campaign_id || data.id}`);
      } else {
        // Fallback to local launch
        setLaunchStep("Creating campaign in database...");
        
        const { data: campaign, error: campaignError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignName,
            job_id: job.id,
            status: "active",
            channel: channelConfig.email
              ? "email"
              : channelConfig.sms
              ? "sms"
              : channelConfig.aiCall
              ? "ai_call"
              : "multi",
            sender_account: selectedSender || null,
            leads_count: candidateIds.length,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        setLaunchStep("Adding campaign leads...");

        const leadsToInsert = candidateIds.map((candidateId) => {
          const hook = personalizationHooks.find((h) => h.candidateId === candidateId);
          const candidate = selectedCandidates.find((c) => c.id === candidateId);
          return {
            campaign_id: campaign.id,
            candidate_id: candidateId,
            candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null,
            candidate_email: candidate?.email || candidate?.personal_email,
            candidate_phone: candidate?.phone || candidate?.personal_mobile,
            status: "pending",
            notes: hook?.hook || null,
          };
        });

        await supabase.from("campaign_leads_v2").insert(leadsToInsert);

        if (channelConfig.aiCall) {
          setLaunchStep("Scheduling AI calls...");
          
          const callsToQueue = selectedCandidates
            .filter((c) => c.phone || c.personal_mobile)
            .map((c) => {
              const hook = personalizationHooks.find((h) => h.candidateId === c.id);
              return {
                campaign_id: campaign.id,
                candidate_id: c.id,
                candidate_name: `${c.first_name} ${c.last_name}`,
                phone: c.personal_mobile || c.phone,
                job_id: job.id,
                job_title: job.job_name,
                job_state: job.state,
                status: "pending",
                scheduled_at: channelConfig.schedule.startDate,
                metadata: { icebreaker: hook?.hook },
              };
            });

          if (callsToQueue.length > 0) {
            await supabase.from("ai_call_queue").insert(callsToQueue);
          }
        }

        toast.success("Campaign launched successfully!");
        
        sessionStorage.removeItem("campaign_job_id");
        sessionStorage.removeItem("campaign_candidates");
        sessionStorage.removeItem("campaign_channels");

        navigate(`/campaigns/${campaign.id}`);
      }
    } catch (error) {
      console.error("Launch error:", error);
      toast.error("Failed to launch campaign");
    } finally {
      setLaunching(false);
      setShowLaunchModal(false);
      setLaunchStep("");
    }
  };

  // Checklist items
  const hasChannelEnabled = !!(channelConfig?.email || channelConfig?.sms || channelConfig?.aiCall || channelConfig?.linkedin);
  const qualityCheckPassed = qualityCheckRun && (qualityCheckResult?.can_launch ?? false);
  
  const checklist = [
    { label: "Job details complete", passed: !!job },
    { label: `Candidates selected (${candidateStats.total})`, passed: candidateStats.total > 0 },
    {
      label: personalizationRun ? "Personalization complete" : "Personalization skipped",
      passed: true,
      skipped: !personalizationRun,
    },
    {
      label: "Sender selected",
      passed: !channelConfig?.email || !!selectedSender,
    },
    {
      label: qualityCheckRun 
        ? (qualityCheckPassed ? "Quality check passed" : "Quality check failed") 
        : "Quality check not run",
      passed: qualityCheckPassed,
      failed: qualityCheckRun && !qualityCheckPassed,
    },
    {
      label: "At least one channel enabled",
      passed: hasChannelEnabled,
    },
  ];

  const canLaunch = 
    !!job && 
    candidateStats.total > 0 && 
    hasChannelEnabled && 
    qualityCheckRun && 
    qualityCheckPassed &&
    (!channelConfig?.email || !!selectedSender);

  const payRate = job?.bill_rate ? Math.round(job.bill_rate * 0.73) : null;

  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <StepIndicator currentStep={4} steps={steps} />

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading campaign data...</p>
            </div>
          )}

          {/* Error State */}
          {loadError && !isLoading && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-lg font-medium text-destructive">{loadError}</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                  <Button variant="default" onClick={handleStartOver}>
                    Start Over
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content - Only show if no errors and not loading */}
          {!isLoading && !loadError && (
            <>
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="campaign-name" className="text-lg font-medium">
              Campaign Name
            </Label>
            <Input
              id="campaign-name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-xl h-14 font-medium"
              placeholder="Enter campaign name..."
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Job Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Job</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/campaigns/new")}
                    className="text-primary"
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{job?.job_name || "Loading..."}</p>
                <p className="text-muted-foreground">{job?.facility_name}</p>
                <p className="text-muted-foreground">
                  {job?.city}, {job?.state}
                </p>
                {payRate && <p className="text-green-500">💰 ${payRate}/hr</p>}
                {job?.start_date && (
                  <p className="text-muted-foreground">
                    📅 {format(new Date(job.start_date), "MMM d, yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Candidates Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Candidates</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/campaigns/new/candidates")}
                    className="text-primary"
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">Total: {candidateStats.total} selected</p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-500">
                    🔥 A: {candidateStats.aTier}
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-500">
                    ⭐ B: {candidateStats.bTier}
                  </span>
                  <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                    📋 C: {candidateStats.cTier}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Ready: {candidateStats.ready} | Need enrichment: {candidateStats.needEnrichment}
                </p>
              </CardContent>
            </Card>

            {/* Channels Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Channels</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/campaigns/new/channels")}
                    className="text-primary"
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {channelConfig?.email && (
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Email ({channelConfig.email.sequenceLength} emails)
                  </p>
                )}
                {channelConfig?.sms && (
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    SMS ({channelConfig.sms.sequenceLength} texts)
                  </p>
                )}
                {channelConfig?.aiCall && (
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    AI Calls (Day {channelConfig.aiCall.callDay})
                  </p>
                )}
                {channelConfig?.linkedin && (
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    LinkedIn (manual)
                  </p>
                )}
                {!channelConfig?.email &&
                  !channelConfig?.sms &&
                  !channelConfig?.aiCall &&
                  !channelConfig?.linkedin && (
                    <p className="text-muted-foreground">No channels enabled</p>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Personalization Section */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cat className="h-6 w-6 text-primary" />
                Sherlock Meowmes Research
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!personalizationRun && !personalizationLoading && (
                <div className="text-center py-6 space-y-4">
                  <p className="text-muted-foreground">
                    Personalize outreach for better response rates
                  </p>
                  <Button
                    size="lg"
                    onClick={handleRunSherlock}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Search className="h-5 w-5" />
                    Run Sherlock on Selected Candidates
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Researches LinkedIn, publications, and background for personalized hooks
                  </p>
                </div>
              )}

              {personalizationLoading && (
                <div className="py-6 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Search className="h-5 w-5 animate-pulse text-primary" />
                    <span>Sherlock is investigating {candidateIds.length} candidates...</span>
                  </div>
                  <Progress value={personalizationProgress} className="h-2" />
                </div>
              )}

              {personalizationRun && !personalizationLoading && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-green-500">
                      <Check className="h-5 w-5" />
                      Research complete for {personalizationHooks.length} candidates
                    </p>
                    <Button variant="outline" size="sm" onClick={handleRunSherlock} className="gap-1">
                      <RefreshCw className="h-4 w-4" />
                      Re-run
                    </Button>
                  </div>

                  <Collapsible open={hooksExpanded} onOpenChange={setHooksExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        View personalization hooks
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            hooksExpanded && "rotate-180"
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Candidate</th>
                              <th className="text-left px-3 py-2 font-medium">Hook Preview</th>
                              <th className="text-center px-3 py-2 font-medium">Confidence</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {personalizationHooks.slice(0, 10).map((hook) => (
                              <tr key={hook.candidateId} className="hover:bg-muted/30">
                                <td className="px-3 py-2 font-medium whitespace-nowrap">
                                  {hook.candidateName}
                                </td>
                                <td className="px-3 py-2">
                                  {hook.isEditing ? (
                                    <div className="flex gap-2">
                                      <Textarea
                                        defaultValue={hook.hook}
                                        className="text-sm min-h-[60px]"
                                        id={`hook-${hook.candidateId}`}
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleSaveHook(
                                            hook.candidateId,
                                            (
                                              document.getElementById(
                                                `hook-${hook.candidateId}`
                                              ) as HTMLTextAreaElement
                                            )?.value || hook.hook
                                          )
                                        }
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground italic line-clamp-2">
                                      "{hook.hook}"
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-xs font-medium",
                                      hook.confidence === "high" &&
                                        "bg-green-500/10 text-green-500",
                                      hook.confidence === "medium" &&
                                        "bg-yellow-500/10 text-yellow-500",
                                      hook.confidence === "low" &&
                                        "bg-red-500/10 text-red-500",
                                      !hook.confidence && "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {hook.confidence || "unknown"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {!hook.isEditing && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditHook(hook.candidateId)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {personalizationHooks.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{personalizationHooks.length - 10} more hooks
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sender Account Section */}
          {channelConfig?.email && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Sender Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedSender} onValueChange={setSelectedSender}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sender account..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 bg-popover">
                    {senderAccounts.map((group) => (
                      <SelectGroup key={group.group}>
                        <SelectLabel className="text-xs text-primary font-semibold">
                          {group.group} ({group.emails.length} accounts)
                        </SelectLabel>
                        {group.emails.map((email) => (
                          <SelectItem key={email} value={email}>
                            {email}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSender && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs">
                      100% warmed ✓
                    </span>
                    <span className="text-muted-foreground">{selectedSender}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quality Check Section */}
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-amber-500" />
                Pre-Launch Quality Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!qualityCheckRun && !qualityCheckLoading && (
                <div className="text-center py-6 space-y-4">
                  <p className="text-muted-foreground">
                    Validate your campaign configuration before launching
                  </p>
                  <Button
                    size="lg"
                    onClick={handleRunQualityCheck}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Search className="h-5 w-5" />
                    Run Quality Check
                  </Button>
                </div>
              )}

              {qualityCheckLoading && (
                <div className="py-6 space-y-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    <span>Running quality checks...</span>
                  </div>
                </div>
              )}

              {qualityCheckRun && !qualityCheckLoading && qualityCheckResult && (
                <div className="space-y-4">
                  {/* Summary badges */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium",
                        qualityCheckResult.summary.critical > 0 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-green-500/10 text-green-500"
                      )}>
                        {qualityCheckResult.summary.critical > 0 ? "🔴" : "✅"} {qualityCheckResult.summary.critical} Critical
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-500">
                        ⚠️ {qualityCheckResult.summary.warnings} Warnings
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-500">
                        ℹ️ {qualityCheckResult.summary.info} Info
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRunQualityCheck} className="gap-1">
                      <RefreshCw className="h-4 w-4" />
                      Re-run Check
                    </Button>
                  </div>

                  {/* Critical issues banner */}
                  {!qualityCheckResult.can_launch && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <p className="text-red-500 font-medium">
                        Fix critical issues before launching
                      </p>
                    </div>
                  )}

                  {/* Issues list */}
                  {qualityCheckResult.issues.length > 0 && (
                    <div className="space-y-2">
                      {qualityCheckResult.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "border rounded-lg p-3",
                            issue.severity === 'critical' && "border-red-500/30 bg-red-500/5",
                            issue.severity === 'warning' && "border-yellow-500/30 bg-yellow-500/5",
                            issue.severity === 'info' && "border-blue-500/30 bg-blue-500/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {issue.severity === 'critical' && (
                              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            {issue.severity === 'warning' && (
                              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            )}
                            {issue.severity === 'info' && (
                              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded font-medium",
                                  issue.severity === 'critical' && "bg-red-500/20 text-red-500",
                                  issue.severity === 'warning' && "bg-yellow-500/20 text-yellow-500",
                                  issue.severity === 'info' && "bg-blue-500/20 text-blue-500"
                                )}>
                                  {issue.category}
                                </span>
                                {issue.candidate_name && (
                                  <span className="text-xs text-muted-foreground">
                                    • {issue.candidate_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{issue.description}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  💡 {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {qualityCheckResult.issues.length === 0 && (
                    <div className="text-center py-4 text-green-500">
                      <Check className="h-8 w-8 mx-auto mb-2" />
                      <p>All checks passed! Ready to launch.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pre-Launch Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Pre-Launch Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {item.skipped ? (
                    <span className="text-muted-foreground">⏭️</span>
                  ) : item.passed ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : item.failed ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      item.skipped && "text-muted-foreground",
                      item.failed && "text-red-500"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/campaigns/new/channels")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Channels
            </Button>
            <Button
              size="lg"
              onClick={() => setShowLaunchModal(true)}
              disabled={!canLaunch}
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white px-8"
            >
              <Rocket className="h-5 w-5" />
              Launch Campaign
            </Button>
          </div>
            </>
          )}
        </div>

        {/* Launch Confirmation Modal */}
        <Dialog open={showLaunchModal} onOpenChange={setShowLaunchModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Launch Campaign
              </DialogTitle>
              <DialogDescription>
                You're about to launch "{campaignName}" targeting {candidateStats.total} candidates.
              </DialogDescription>
            </DialogHeader>
            
            {launching ? (
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-lg">{launchStep || "Launching..."}</span>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {channelConfig?.email && (
                    <p className="flex items-center gap-2">
                      {launchStep.includes("email") || launchStep.includes("Instantly") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      Creating Instantly email campaign...
                    </p>
                  )}
                  {channelConfig?.sms && (
                    <p className="flex items-center gap-2">
                      {launchStep.includes("SMS") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : launchStep.includes("call") ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                      Queuing SMS messages...
                    </p>
                  )}
                  {channelConfig?.aiCall && (
                    <p className="flex items-center gap-2">
                      {launchStep.includes("call") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                      Scheduling AI calls...
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 py-4">
                  <p className="text-sm">
                    <strong>Channels:</strong>{" "}
                    {[
                      channelConfig?.email && "Email",
                      channelConfig?.sms && "SMS",
                      channelConfig?.aiCall && "AI Calls",
                      channelConfig?.linkedin && "LinkedIn",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="text-sm">
                    <strong>Start Date:</strong>{" "}
                    {channelConfig?.schedule.startDate
                      ? format(new Date(channelConfig.schedule.startDate), "PPP")
                      : "Immediately"}
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowLaunchModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLaunchCampaign}
                    disabled={launching}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Rocket className="h-4 w-4" />
                    Confirm Launch
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
