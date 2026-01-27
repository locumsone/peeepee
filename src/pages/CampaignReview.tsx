import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  const [job, setJob] = useState<Job | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SelectedCandidate[]>([]);
  const [channels, setChannels] = useState<ChannelConfig>({});
  const [campaignName, setCampaignName] = useState("");
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

      // Load channel config
      const storedCampaignChannels = sessionStorage.getItem("campaign_channels");
      const storedChannels = sessionStorage.getItem("channelConfig");
      const legacyChannels = sessionStorage.getItem("channels");
      let channelConfig: ChannelConfig = {};

      if (storedCampaignChannels) {
        try { 
          const modern = JSON.parse(storedCampaignChannels);
          if (modern.email) {
            channelConfig.email = { 
              sender: modern.email.sender || senderAccounts[0].emails[0], 
              sequenceLength: modern.email.steps?.length || 4, 
              gapDays: 3 
            };
          }
          if (modern.sms) {
            channelConfig.sms = { 
              fromNumber: modern.sms.fromNumber || "", 
              sequenceLength: modern.sms.steps?.length || 1 
            };
          }
          if (modern.aiCall) {
            channelConfig.aiCall = { 
              fromNumber: modern.aiCall.fromNumber || "", 
              callDay: 10, 
              transferTo: "" 
            };
          }
          channelConfig.linkedin = modern.linkedin || false;
          channelConfig.schedule = modern.schedule;
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

  // Sync draft data to local state when draft loads
  useEffect(() => {
    if (!isDraftLoading && draft.jobId) {
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
    } else if (!isDraftLoading) {
      // Fall back to legacy loading
      console.log("[CampaignReview] No draft found, falling back to legacy session loading");
      loadSessionData();
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

  // Calculate step statuses
  const stepStatuses = useMemo(() => {
    const verify: StepStatus = job ? "complete" : "pending";
    
    let candidatesStatus: StepStatus = "pending";
    if (candidates.length > 0) {
      if (tierStats.needsEnrichment === 0) {
        candidatesStatus = "complete";
      } else {
        candidatesStatus = "blocked";
      }
    }

    let channelsStatus: StepStatus = "pending";
    const hasChannels = Object.keys(channels).some(k => channels[k as keyof ChannelConfig]);
    if (hasChannels) {
      channelsStatus = integrationsConnected ? "complete" : "blocked";
    }

    const preview: StepStatus = candidates.length > 0 ? "complete" : "pending";

    return { verify, candidates: candidatesStatus, channels: channelsStatus, preview };
  }, [job, candidates, tierStats, channels, integrationsConnected]);

  // Calculate blockers
  const blockers = useMemo(() => {
    const list: Blocker[] = [];
    
    if (!job) {
      list.push({ step: 1, message: "No job selected" });
    }
    if (candidates.length === 0) {
      list.push({ step: 2, message: "No candidates selected" });
    } else if (tierStats.needsEnrichment > 0) {
      list.push({ step: 2, message: `${tierStats.needsEnrichment} candidates missing contact info` });
    }
    if (!integrationsConnected && Object.keys(channels).some(k => channels[k as keyof ChannelConfig])) {
      const disconnected = integrationDetails.filter(i => i.status === 'disconnected' || (!i.connected && i.status !== 'manual')).map(i => i.name);
      if (disconnected.length > 0) {
        list.push({ step: 3, message: `${disconnected.join(", ")} disconnected` });
      }
    }

    return list;
  }, [job, candidates, tierStats, channels, integrationsConnected, integrationDetails]);

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

  if (isLoading || isDraftLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaign data...</p>
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
