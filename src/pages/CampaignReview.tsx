import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReviewStepCard, StepStatus } from "@/components/campaign-review/ReviewStepCard";
import { StepVerifyCampaign } from "@/components/campaign-review/StepVerifyCampaign";
import { StepPrepareCandidates } from "@/components/campaign-review/StepPrepareCandidates";
import { StepConnectChannels } from "@/components/campaign-review/StepConnectChannels";
import { StepPreviewMessage } from "@/components/campaign-review/StepPreviewMessage";
import { LaunchStatusBar } from "@/components/campaign-review/LaunchStatusBar";
import { DraftRecoveryModal } from "@/components/campaign-review/DraftRecoveryModal";
import { useCampaignDraft } from "@/hooks/useCampaignDraft";
import type {
  Job,
  ChannelConfig,
  SelectedCandidate,
  TierStats,
  QualityCheckResult,
  IntegrationStatus as IntegrationStatusType,
} from "@/components/campaign-review/types";

const senderAccounts = [
  { group: "Primary", emails: ["rainey@locums.one", "tswift@locumsone.com"] },
  { group: "Secondary", emails: ["recruiting@locumsone.com", "outreach@locums.one"] },
];

interface Blocker {
  step: number;
  message: string;
}

export default function CampaignReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftCampaignId = searchParams.get("draft");
  
  // Use the unified campaign draft hook
  const {
    draft,
    isLoading: isDraftLoading,
    isDirty,
    lastSaved,
    showRecoveryPrompt,
    updateJob,
    updateCandidates,
    updateChannels,
    saveDraft,
    clearDraft,
    recoverDraft,
    discardAndStartFresh,
    dismissRecovery,
  } = useCampaignDraft();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDraftFromDb, setIsLoadingDraftFromDb] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SelectedCandidate[]>([]);
  const [channels, setChannels] = useState<ChannelConfig>({});
  const [campaignName, setCampaignName] = useState("");
  const [existingCampaignId, setExistingCampaignId] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState(senderAccounts[0].emails[0]);
  const [tierStats, setTierStats] = useState<TierStats>({
    tier1: 0, tier2: 0, tier3: 0, readyCount: 0, needsEnrichment: 0,
  });
  const [integrationsConnected, setIntegrationsConnected] = useState(false);
  const [integrationDetails, setIntegrationDetails] = useState<IntegrationStatusType[]>([]);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);

  // Legacy session loading function (fallback)
  const loadSessionData = async () => {
    setIsLoading(true);
    try {
      const storedJobId = sessionStorage.getItem("campaign_job_id");
      const storedJob = sessionStorage.getItem("campaign_job");

      if (storedJobId) {
        setJobId(storedJobId);
        if (storedJob) {
          try {
            const parsedJob = JSON.parse(storedJob);
            setJob(parsedJob);
            setCampaignName(`${parsedJob.specialty || parsedJob.job_name || "Campaign"} - ${parsedJob.facility_name || "Facility"} - ${new Date().toLocaleDateString()}`);
          } catch (e) { console.error("Failed to parse stored job:", e); }
        }
        const { data: jobData } = await supabase.from("jobs").select("*").eq("id", storedJobId).maybeSingle();
        if (jobData) {
          setJob(jobData as unknown as Job);
          if (!campaignName) setCampaignName(`${jobData.specialty || jobData.job_name || "Campaign"} - ${jobData.facility_name || "Facility"} - ${new Date().toLocaleDateString()}`);
        }
      }

      const storedCandidates = sessionStorage.getItem("campaign_candidates");
      const storedCandidateIds = sessionStorage.getItem("campaign_candidate_ids");
      const legacySelectedCandidates = sessionStorage.getItem("selectedCandidates");

      let candidateIds: string[] = [];
      let parsedCandidates: SelectedCandidate[] = [];

      if (storedCandidates) {
        try { parsedCandidates = JSON.parse(storedCandidates); candidateIds = parsedCandidates.map((c) => c.id); } catch (e) { console.error("Failed to parse stored candidates:", e); }
      } else if (storedCandidateIds) {
        try { candidateIds = JSON.parse(storedCandidateIds); } catch (e) { console.error("Failed to parse stored candidate IDs:", e); }
      } else if (legacySelectedCandidates) {
        try { const legacy = JSON.parse(legacySelectedCandidates); if (Array.isArray(legacy)) { parsedCandidates = legacy; candidateIds = legacy.map((c) => c.id); } } catch (e) { console.error("Failed to parse legacy candidates:", e); }
      }

      if (candidateIds.length > 0 && parsedCandidates.length === 0) {
        const { data: candidateData } = await supabase.from("candidates").select("*").in("id", candidateIds);
        if (candidateData) parsedCandidates = candidateData as SelectedCandidate[];
      }

      setCandidates(parsedCandidates);

      // Load channel config - normalize from various formats
      const storedCampaignChannels = sessionStorage.getItem("campaign_channels");
      const storedChannels = sessionStorage.getItem("channelConfig");
      const legacyChannels = sessionStorage.getItem("channels");
      let channelConfig: ChannelConfig = {};

      console.log("[CampaignReview] Loading channels from sessionStorage:", storedCampaignChannels);

      if (storedCampaignChannels) {
        try { 
          const parsed = JSON.parse(storedCampaignChannels);
          
          // Normalize email - handle both "steps" array and "sequenceLength" formats
          if (parsed.email) {
            channelConfig.email = { 
              provider: parsed.email.provider,
              sender: parsed.email.sender || senderAccounts[0].emails[0], 
              senderName: parsed.email.senderName,
              sequenceLength: parsed.email.steps?.length || parsed.email.sequenceLength || 4, 
              gapDays: parsed.email.gapDays || 3,
              steps: parsed.email.steps, // Preserve steps array for launch
            };
          }
          
          // Normalize SMS - handle both formats
          if (parsed.sms) {
            channelConfig.sms = { 
              fromNumber: parsed.sms.fromNumber || "+12185628671", 
              sequenceLength: parsed.sms.steps?.length || parsed.sms.sequenceLength || 1,
              steps: parsed.sms.steps, // Preserve steps array for launch
            };
          }
          
          // Normalize AI Calls - handle both formats
          if (parsed.aiCall) {
            channelConfig.aiCall = { 
              fromNumber: parsed.aiCall.fromNumber || "", 
              callDay: parsed.aiCall.callDay || 10, 
              transferTo: parsed.aiCall.transferTo || "",
              steps: parsed.aiCall.steps, // Preserve steps array
            };
          }
          
          channelConfig.linkedin = parsed.linkedin || false;
          channelConfig.schedule = parsed.schedule;
          channelConfig.sequenceSteps = parsed.sequenceSteps; // Preserve full sequence
          
          console.log("[CampaignReview] Normalized channelConfig:", channelConfig);
        } catch (e) { console.error("Failed to parse campaign channels:", e); }
      } else if (storedChannels) {
        try { channelConfig = JSON.parse(storedChannels); } catch (e) { console.error("Failed to parse channel config:", e); }
      } else if (legacyChannels) {
        try {
          const legacy = JSON.parse(legacyChannels);
          if (legacy.email?.enabled) channelConfig.email = { sender: legacy.email.sender || senderAccounts[0].emails[0], sequenceLength: legacy.email.sequenceLength || 4, gapDays: legacy.email.gapDays || 3 };
          if (legacy.sms?.enabled) channelConfig.sms = { fromNumber: legacy.sms.fromNumber || "", sequenceLength: legacy.sms.sequenceLength || 2 };
          if (legacy.aiCall?.enabled) channelConfig.aiCall = { fromNumber: legacy.aiCall.fromNumber || "", callDay: legacy.aiCall.callDay || 3, transferTo: legacy.aiCall.transferTo || "" };
          channelConfig.linkedin = legacy.linkedin?.enabled || false;
          channelConfig.schedule = legacy.schedule;
        } catch (e) { console.error("Failed to parse legacy channels:", e); }
      }
      setChannels(channelConfig);
      if (channelConfig.email?.sender) setSenderEmail(channelConfig.email.sender);
    } catch (error) {
      console.error("Failed to load session data:", error);
      toast({ title: "Error Loading Data", description: "Could not load campaign data. Please start over.", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  // Load draft campaign from database
  const loadDraftFromDatabase = async (campaignId: string) => {
    setIsLoadingDraftFromDb(true);
    try {
      // Load campaign with job
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select(`
          *,
          jobs (*)
        `)
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError) throw campaignError;
      if (!campaignData) {
        toast({ title: "Draft Not Found", description: "The draft campaign could not be found.", variant: "destructive" });
        navigate("/campaigns");
        return;
      }

      // Set campaign and job data
      setExistingCampaignId(campaignId);
      setCampaignName(campaignData.name || "");
      setJobId(campaignData.job_id);
      
      if (campaignData.jobs) {
        const jobData = campaignData.jobs as unknown as Job;
        setJob(jobData);
      }

      // Load candidates from campaign_leads_v2
      const { data: leadsData, error: leadsError } = await supabase
        .from("campaign_leads_v2")
        .select("*")
        .eq("campaign_id", campaignId);

      if (leadsError) throw leadsError;

      if (leadsData && leadsData.length > 0) {
        // Map leads to SelectedCandidate format
        const mappedCandidates: SelectedCandidate[] = leadsData.map((lead) => ({
          id: lead.candidate_id || lead.id,
          first_name: lead.candidate_name?.split(" ")[0] || "",
          last_name: lead.candidate_name?.split(" ").slice(1).join(" ") || "",
          email: lead.candidate_email || undefined,
          phone: lead.candidate_phone || undefined,
          specialty: lead.candidate_specialty || undefined,
          state: lead.candidate_state || undefined,
          tier: lead.tier || undefined,
          unified_score: lead.match_score ? `${lead.match_score >= 80 ? "A" : lead.match_score >= 60 ? "B" : "C"}` : undefined,
        }));
        setCandidates(mappedCandidates);
      } else if (campaignData.job_id) {
        // No leads yet - check for candidates via job matches
        const { data: matchData } = await supabase
          .from("candidate_job_matches")
          .select(`
            *,
            candidates (*)
          `)
          .eq("job_id", campaignData.job_id)
          .limit(50);

        if (matchData && matchData.length > 0) {
          const mappedCandidates: SelectedCandidate[] = matchData
            .filter((m) => m.candidates)
            .map((m) => {
              const c = m.candidates as any;
              return {
                id: c.id,
                first_name: c.first_name || "",
                last_name: c.last_name || "",
                email: c.email || c.personal_email || undefined,
                phone: c.phone || c.personal_mobile || undefined,
                specialty: c.specialty || undefined,
                state: c.state || undefined,
                tier: m.match_score ? (m.match_score >= 80 ? 1 : m.match_score >= 60 ? 2 : 3) : undefined,
                unified_score: m.match_grade || undefined,
                icebreaker: m.icebreaker || undefined,
                talking_points: m.talking_points || undefined,
              };
            });
          setCandidates(mappedCandidates);
        }
      }

      // Parse channel from campaign (if stored)
      if (campaignData.channel) {
        const channelConfig: ChannelConfig = {};
        const channelStr = campaignData.channel.toLowerCase();
        
        if (channelStr.includes("email") || channelStr.includes("all")) {
          channelConfig.email = {
            sender: campaignData.sender_account || senderAccounts[0].emails[0],
            sequenceLength: 4,
            gapDays: 3,
          };
          if (campaignData.sender_account) {
            setSenderEmail(campaignData.sender_account);
          }
        }
        if (channelStr.includes("sms") || channelStr.includes("all")) {
          channelConfig.sms = { fromNumber: "", sequenceLength: 1 };
        }
        if (channelStr.includes("call") || channelStr.includes("voice") || channelStr.includes("all")) {
          channelConfig.aiCall = { fromNumber: "", callDay: 10, transferTo: "" };
        }
        
        setChannels(channelConfig);
      }

      console.log("[CampaignReview] Loaded draft from database:", {
        campaignId,
        name: campaignData.name,
        jobId: campaignData.job_id,
        candidatesCount: leadsData?.length || 0,
      });
      
    } catch (error) {
      console.error("Failed to load draft from database:", error);
      toast({ title: "Error Loading Draft", description: "Could not load the draft campaign.", variant: "destructive" });
    } finally {
      setIsLoadingDraftFromDb(false);
      setIsLoading(false);
    }
  };

  // Load draft from database if ?draft= param is present
  useEffect(() => {
    if (draftCampaignId) {
      loadDraftFromDatabase(draftCampaignId);
    }
  }, [draftCampaignId]);

  // Sync draft data to local state when draft loads (only if not loading from DB)
  useEffect(() => {
    // Skip if loading from database via ?draft= param
    if (draftCampaignId || isLoadingDraftFromDb) return;
    if (isDraftLoading) return;
    
    // Check if draft has meaningful data
    const hasDraftData = draft.jobId && draft.candidates.length > 0;
    
    if (hasDraftData) {
      console.log("[CampaignReview] Loading from draft:", {
        jobId: draft.jobId,
        candidatesCount: draft.candidates.length,
        hasChannels: Object.keys(draft.channels).length > 0,
      });
      setJobId(draft.jobId);
      setJob(draft.job);
      setCandidates(draft.candidates);
      setChannels(draft.channels);
      setCampaignName(draft.campaignName || "");
      if (draft.channels?.email?.sender) {
        setSenderEmail(draft.channels.email.sender);
      }
      setIsLoading(false);
    } else {
      // Fall back to legacy loading - but try to get data from sessionStorage first
      console.log("[CampaignReview] No complete draft found, checking sessionStorage...");
      
      // Check if sessionStorage has data that draft might have missed
      const storedJobId = sessionStorage.getItem("campaign_job_id");
      const storedCandidates = sessionStorage.getItem("campaign_candidates");
      
      if (storedJobId && storedCandidates) {
        console.log("[CampaignReview] Found sessionStorage data, loading...");
        loadSessionData();
      } else if (draft.jobId) {
        // Draft has job but no candidates - partial data
        console.log("[CampaignReview] Draft has partial data, loading what's available");
        setJobId(draft.jobId);
        setJob(draft.job);
        setCandidates(draft.candidates);
        setChannels(draft.channels);
        setCampaignName(draft.campaignName || "");
        setIsLoading(false);
      } else {
        // No data anywhere
        console.log("[CampaignReview] No data found anywhere");
        setIsLoading(false);
      }
    }
  }, [isDraftLoading, draft]);

  // Sync local changes back to draft (debounced via the hook's auto-save)
  useEffect(() => {
    if (!isLoading && job) {
      updateJob(job, jobId || undefined);
    }
  }, [job, jobId, isLoading, updateJob]);

  useEffect(() => {
    if (!isLoading && candidates.length > 0) {
      updateCandidates(candidates);
    }
  }, [candidates, isLoading, updateCandidates]);

  useEffect(() => {
    if (!isLoading && Object.keys(channels).length > 0) {
      updateChannels(channels);
    }
  }, [channels, isLoading, updateChannels]);

  // Recalculate tier stats when candidates change
  useEffect(() => {
    const stats: TierStats = { tier1: 0, tier2: 0, tier3: 0, readyCount: 0, needsEnrichment: 0 };
    candidates.forEach((c) => {
      const tier = c.tier || (c.unified_score?.startsWith("A") ? 1 : c.unified_score?.startsWith("B") ? 2 : 3);
      if (tier === 1) stats.tier1++; else if (tier === 2) stats.tier2++; else stats.tier3++;
      const hasContact = (c.email || c.personal_email) || (c.phone || c.personal_mobile);
      if (hasContact) stats.readyCount++; else stats.needsEnrichment++;
    });
    setTierStats(stats);
  }, [candidates]);

  const handleStartOver = () => {
    clearDraft();
    navigate("/campaigns/new");
  };

  const handleCandidatesUpdate = (updatedCandidates: SelectedCandidate[]) => {
    setCandidates(updatedCandidates);
  };

  const handleIntegrationStatusChange = (connected: boolean, details?: IntegrationStatusType[]) => {
    setIntegrationsConnected(connected);
    if (details) setIntegrationDetails(details);
  };

  // Calculate step statuses - enrichment shows warning but doesn't block
  const stepStatuses = useMemo(() => {
    const verify: StepStatus = job ? "complete" : "pending";
    
    let candidatesStatus: StepStatus = "pending";
    if (candidates.length > 0) {
      // Count candidates with at least email OR phone
      const readyCount = candidates.filter(c => 
        (c.email || c.personal_email) || (c.phone || c.personal_mobile)
      ).length;
      
      if (readyCount === candidates.length) {
        candidatesStatus = "complete";
      } else if (readyCount > 0) {
        // Some have contact info - show as complete with warning indicator
        candidatesStatus = "complete";
      } else {
        // No one has contact info - blocked
        candidatesStatus = "blocked";
      }
    }

    // Channels are optional - show complete if any are selected
    let channelsStatus: StepStatus = "pending";
    const hasChannels = Object.keys(channels).some(k => channels[k as keyof ChannelConfig]);
    if (hasChannels) {
      channelsStatus = "complete";
    }

    const preview: StepStatus = candidates.length > 0 ? "complete" : "pending";

    return { verify, candidates: candidatesStatus, channels: channelsStatus, preview };
  }, [job, candidates, channels]);

  // Calculate blockers - enrichment is now a warning, not a blocker
  const blockers = useMemo(() => {
    const list: Blocker[] = [];
    
    if (!job) {
      list.push({ step: 1, message: "No job selected" });
    }
    if (candidates.length === 0) {
      list.push({ step: 2, message: "No candidates selected" });
    }
    // NOTE: Missing contact info is no longer a blocker - we'll launch with candidates who have contact info
    // and skip those who don't (they can be enriched later)
    
    // Only block if integrations are truly required and disconnected
    // For now, we don't block on integrations either - they're optional
    
    return list;
  }, [job, candidates]);

  // Collapsed summaries
  const getVerifySummary = () => {
    if (!job) return "";
    const rate = job.hourly_rate || job.bill_rate || job.pay_rate;
    return `${job.specialty || job.job_name || "Position"} @ ${job.facility_name || "Facility"}${rate ? ` - $${rate}/hr` : ""}`;
  };

  const getCandidatesSummary = () => {
    return `${candidates.length} candidates · ${tierStats.readyCount} ready to contact`;
  };

  const getChannelsSummary = () => {
    const activeChannels = Object.keys(channels).filter(k => channels[k as keyof ChannelConfig]);
    return activeChannels.length > 0 ? `${activeChannels.length} channels connected` : "No channels";
  };

  if (isLoading || isDraftLoading || isLoadingDraftFromDb) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isLoadingDraftFromDb ? "Loading draft campaign..." : "Loading campaign data..."}
          </p>
        </div>
      </div>
    );
  }

  if (!jobId || candidates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">No Campaign Data</h2>
          <p className="text-muted-foreground mb-4">Please start from the beginning to create a campaign.</p>
          <Button onClick={handleStartOver}>Start New Campaign</Button>
        </div>

        {/* Draft Recovery Modal */}
        <DraftRecoveryModal
          open={showRecoveryPrompt}
          lastSavedAt={draft.lastSavedAt || new Date().toISOString()}
          campaignName={draft.campaignName}
          candidateCount={draft.candidates.length}
          currentStep={draft.currentStep}
          onRecover={recoverDraft}
          onDiscard={discardAndStartFresh}
          onDismiss={dismissRecovery}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Review & Launch</h1>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-lg font-medium bg-transparent border-none px-0 h-auto focus-visible:ring-0 text-muted-foreground hover:text-foreground"
              placeholder="Campaign name..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns/new/channels")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={handleStartOver}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </div>
        </div>

        {/* Step 1: Verify Campaign */}
        <ReviewStepCard
          stepNumber={1}
          title="Verify Campaign"
          status={stepStatuses.verify}
          collapsedSummary={getVerifySummary()}
          defaultOpen={stepStatuses.verify !== "complete"}
        >
          <StepVerifyCampaign job={job} channels={channels} campaignName={campaignName} />
        </ReviewStepCard>

        {/* Step 2: Prepare Candidates */}
        <ReviewStepCard
          stepNumber={2}
          title="Prepare Candidates"
          subtitle={tierStats.needsEnrichment > 0 ? `${tierStats.needsEnrichment} candidates need contact info` : undefined}
          status={stepStatuses.candidates}
          collapsedSummary={getCandidatesSummary()}
          defaultOpen={stepStatuses.candidates !== "complete"}
          autoCollapseOnComplete={true}
        >
          <StepPrepareCandidates
            candidates={candidates}
            tierStats={tierStats}
            jobId={jobId}
            onCandidatesUpdate={handleCandidatesUpdate}
          />
        </ReviewStepCard>

        {/* Step 3: Connect Channels */}
        <ReviewStepCard
          stepNumber={3}
          title="Connect Channels"
          status={stepStatuses.channels}
          collapsedSummary={getChannelsSummary()}
          defaultOpen={stepStatuses.channels !== "complete"}
        >
          <StepConnectChannels
            channels={channels}
            senderEmail={senderEmail}
            onStatusChange={handleIntegrationStatusChange}
          />
        </ReviewStepCard>

        {/* Step 4: Preview Message */}
        <ReviewStepCard
          stepNumber={4}
          title="Preview Message"
          status={stepStatuses.preview}
          defaultOpen={false}
          autoCollapseOnComplete={false}
        >
          <StepPreviewMessage candidates={candidates} job={job} />
        </ReviewStepCard>
      </div>

      {/* Launch Status Bar with auto-save indicator */}
      <LaunchStatusBar
        jobId={jobId}
        job={job}
        campaignName={campaignName}
        candidates={candidates}
        channels={channels}
        senderEmail={senderEmail}
        blockers={blockers}
        qualityResult={qualityResult}
        integrationsConnected={integrationsConnected}
        lastSaved={lastSaved}
        isDirty={isDirty}
        onSaveDraft={saveDraft}
        onLaunchSuccess={clearDraft}
      />

      {/* Draft Recovery Modal */}
      <DraftRecoveryModal
        open={showRecoveryPrompt}
        lastSavedAt={draft.lastSavedAt || new Date().toISOString()}
        campaignName={draft.campaignName}
        candidateCount={draft.candidates.length}
        currentStep={draft.currentStep}
        onRecover={recoverDraft}
        onDiscard={discardAndStartFresh}
        onDismiss={dismissRecovery}
      />
    </div>
  );
}
