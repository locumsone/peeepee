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

export default function CampaignReview() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
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

  // Launch state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates");
    const storedChannels = sessionStorage.getItem("campaign_channels");

    if (!storedJobId || !storedCandidates || !storedChannels) {
      navigate("/campaigns/new");
      return;
    }

    setJobId(storedJobId);
    const candidates = JSON.parse(storedCandidates);
    setCandidateIds(candidates);
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

    // Fetch candidate stats
    const fetchCandidateStats = async () => {
      const { data } = await supabase
        .from("candidates")
        .select("id, enrichment_tier, phone, personal_mobile, email, personal_email")
        .in("id", candidates);

      if (data) {
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

  const handleLaunchCampaign = async () => {
    if (!job || !channelConfig) return;

    setLaunching(true);

    try {
      // 1. Insert campaign
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

      // 2. Insert campaign leads
      const leadsToInsert = candidateIds.map((candidateId) => {
        const hook = personalizationHooks.find((h) => h.candidateId === candidateId);
        return {
          campaign_id: campaign.id,
          candidate_id: candidateId,
          status: "pending",
          notes: hook?.hook || null,
        };
      });

      const { error: leadsError } = await supabase.from("campaign_leads_v2").insert(leadsToInsert);
      if (leadsError) console.error("Leads insert error:", leadsError);

      // 3. If AI calls enabled, queue calls
      if (channelConfig.aiCall) {
        const { data: candidates } = await supabase
          .from("candidates")
          .select("id, first_name, last_name, phone, personal_mobile")
          .in("id", candidateIds);

        const callsToQueue = (candidates || [])
          .filter((c) => c.phone || c.personal_mobile)
          .map((c) => ({
            campaign_id: campaign.id,
            candidate_id: c.id,
            candidate_name: `${c.first_name} ${c.last_name}`,
            phone: c.personal_mobile || c.phone,
            job_id: job.id,
            job_title: job.job_name,
            job_state: job.state,
            status: "pending",
            scheduled_at: channelConfig.schedule.startDate,
          }));

        if (callsToQueue.length > 0) {
          await supabase.from("ai_call_queue").insert(callsToQueue);
        }
      }

      toast.success("Campaign launched successfully!");
      
      // Clear session storage
      sessionStorage.removeItem("campaign_job_id");
      sessionStorage.removeItem("campaign_candidates");
      sessionStorage.removeItem("campaign_channels");

      navigate(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error("Launch error:", error);
      toast.error("Failed to launch campaign");
    } finally {
      setLaunching(false);
      setShowLaunchModal(false);
    }
  };

  // Checklist items
  const checklist = [
    { label: "Job details complete", passed: !!job },
    { label: `Candidates selected (${candidateStats.total} total)`, passed: candidateStats.total > 0 },
    {
      label: `${candidateStats.needEnrichment} candidates need enrichment`,
      passed: candidateStats.needEnrichment === 0,
      warning: candidateStats.needEnrichment > 0,
    },
    {
      label: personalizationRun ? "Personalization complete" : "Personalization skipped",
      passed: true,
      skipped: !personalizationRun,
    },
    {
      label: "Sender account selected",
      passed: !channelConfig?.email || !!selectedSender,
    },
    {
      label: "At least one channel enabled",
      passed: !!(channelConfig?.email || channelConfig?.sms || channelConfig?.aiCall || channelConfig?.linkedin),
    },
  ];

  const canLaunch = checklist.every((item) => item.passed || item.warning || item.skipped);

  const payRate = job?.bill_rate ? Math.round(job.bill_rate * 0.73) : null;

  return (
    <Layout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <StepIndicator currentStep={4} steps={steps} />

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

          {/* Pre-Launch Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Pre-Launch Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {item.warning ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  ) : item.skipped ? (
                    <span className="text-muted-foreground">⏭️</span>
                  ) : item.passed ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-destructive" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      item.warning && "text-yellow-500",
                      item.skipped && "text-muted-foreground"
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
                {launching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Confirm Launch
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
