import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  CampaignHeader,
  CampaignSummaryCard,
  IntegrationStatus,
  QualityGate,
  PersonalizationPanel,
  LaunchControl,
} from "@/components/campaign-review";
import type {
  Job,
  ChannelConfig,
  SelectedCandidate,
  TierStats,
  QualityCheckResult,
} from "@/components/campaign-review/types";

const senderAccounts = [
  { group: "Primary", emails: ["rainey@locums.one", "tswift@locumsone.com"] },
  { group: "Secondary", emails: ["recruiting@locumsone.com", "outreach@locums.one"] },
];

export default function CampaignReview() {
  const navigate = useNavigate();
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
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);

  useEffect(() => {
    loadSessionData();
  }, []);

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

      const stats: TierStats = { tier1: 0, tier2: 0, tier3: 0, readyCount: 0, needsEnrichment: 0 };
      parsedCandidates.forEach((c) => {
        const tier = c.tier || (c.unified_score?.startsWith("A") ? 1 : c.unified_score?.startsWith("B") ? 2 : 3);
        if (tier === 1) stats.tier1++; else if (tier === 2) stats.tier2++; else stats.tier3++;
        const hasContact = (c.email || c.personal_email) && (c.phone || c.personal_mobile);
        if (hasContact) stats.readyCount++; else stats.needsEnrichment++;
      });
      setTierStats(stats);

      const storedChannels = sessionStorage.getItem("channelConfig");
      const legacyChannels = sessionStorage.getItem("channels");
      let channelConfig: ChannelConfig = {};

      if (storedChannels) {
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

  const handleStartOver = () => {
    ["campaign_job", "campaign_job_id", "campaign_candidates", "campaign_candidate_ids", "channelConfig", "selectedCandidates", "channels"].forEach(k => sessionStorage.removeItem(k));
    navigate("/campaigns/new");
  };

  const handleBack = () => navigate("/campaigns/new/channels");

  const handleCandidatesUpdate = (updatedCandidates: SelectedCandidate[]) => {
    setCandidates(updatedCandidates);
    sessionStorage.setItem("campaign_candidates", JSON.stringify(updatedCandidates));
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Loading campaign data...</p></div></div>;

  if (!jobId || candidates.length === 0) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center max-w-md"><h2 className="text-xl font-semibold text-foreground mb-2">No Campaign Data</h2><p className="text-muted-foreground mb-4">Please start from the beginning.</p><button onClick={handleStartOver} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Start New Campaign</button></div></div>;

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      <CampaignHeader campaignName={campaignName} onCampaignNameChange={setCampaignName} onStartOver={handleStartOver} onBack={handleBack} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <CampaignSummaryCard job={job} candidateCount={candidates.length} tierStats={tierStats} channels={channels} />
          <IntegrationStatus channels={channels} senderEmail={senderEmail} onStatusChange={setIntegrationsConnected} />
        </div>
        <div className="space-y-6">
          <PersonalizationPanel jobId={jobId} candidates={candidates} onCandidatesUpdate={handleCandidatesUpdate} />
        </div>
        <div className="space-y-6">
          <QualityGate jobId={jobId} campaignName={campaignName} candidates={candidates} channels={channels} senderEmail={senderEmail} integrationsConnected={integrationsConnected} onResultChange={setQualityResult} />
          <LaunchControl jobId={jobId} campaignName={campaignName} candidates={candidates} channels={channels} senderEmail={senderEmail} qualityResult={qualityResult} integrationsConnected={integrationsConnected} />
        </div>
      </div>
    </div>
  );
}
