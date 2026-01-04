import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Rocket, CheckCircle2, Mail, MessageSquare, Phone,
  Users, DollarSign, ArrowLeft, Loader2, PartyPopper,
  MapPin, Building2, Briefcase, Calendar, Clock, XCircle,
  AlertTriangle, Search, Eye, RefreshCw
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobInfo {
  job_name?: string;
  facility_name?: string;
  city?: string;
  state?: string;
  pay_rate?: number;
}

interface Candidate {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  tier?: number;
  personal_mobile?: string;
  personal_email?: string;
  has_personal_contact?: boolean;
  needs_enrichment?: boolean;
  city?: string;
  state?: string;
  [key: string]: any;
}

interface TieredCandidates {
  tier1: Candidate[];
  tier2: Candidate[];
  tier3: Candidate[];
  tier4: Candidate[];
}

// Mock sender accounts - replace with actual Instantly integration
const senderAccounts = [
  { id: "sender1", email: "recruiting@company.com", name: "Recruiting Team" },
  { id: "sender2", email: "talent@company.com", name: "Talent Acquisition" },
  { id: "sender3", email: "opportunities@company.com", name: "Career Opportunities" },
];

const isReadyToContact = (candidate: Candidate): boolean => {
  return !!(candidate.personal_mobile || candidate.personal_email || candidate.has_personal_contact);
};

const LaunchConfirmation = () => {
  const navigate = useNavigate();
  
  // Campaign settings state
  const [campaignName, setCampaignName] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [callEnabled, setCallEnabled] = useState(false);
  const [callsPerDay, setCallsPerDay] = useState(10);
  const [callStartTime, setCallStartTime] = useState("9:00 AM");
  const [scheduleType, setScheduleType] = useState("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Channel config state
  const [selectedSender, setSelectedSender] = useState("");
  const configuredPhone = "+1 (555) 123-4567"; // Mock - would come from settings
  const ariaAgentStatus = "active"; // Mock - would come from Retell
  
  // Data state
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [tieredCandidates, setTieredCandidates] = useState<TieredCandidates | null>(null);
  
  // Launch state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [launchResults, setLaunchResults] = useState<{
    emailsQueued: number;
    smsSent: number;
    callsScheduled: number;
    campaignId: string;
  } | null>(null);

  useEffect(() => {
    // Load job info
    const storedJob = sessionStorage.getItem("currentJob");
    if (storedJob) {
      const job = JSON.parse(storedJob);
      setJobInfo(job);
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setCampaignName(`${job.job_name || 'Campaign'} - ${today}`);
    }
    
    // Load tiered candidates
    const storedTiers = sessionStorage.getItem("tieredCandidates");
    if (storedTiers) {
      setTieredCandidates(JSON.parse(storedTiers));
    }
  }, []);

  // Calculate stats
  const tier1Count = tieredCandidates?.tier1?.length || 0;
  const tier2Count = tieredCandidates?.tier2?.length || 0;
  const tier3Count = tieredCandidates?.tier3?.length || 0;
  const totalCandidates = tier1Count + tier2Count + tier3Count;

  const enrichmentStats = useMemo(() => {
    if (!tieredCandidates) return { tier1Ready: 0, tier1NeedsEnrichment: 0, totalReady: 0, totalNeedsEnrichment: 0 };
    
    const tier1Ready = tieredCandidates.tier1.filter(isReadyToContact).length;
    const tier1NeedsEnrichment = tier1Count - tier1Ready;
    
    const tier2Ready = tieredCandidates.tier2.filter(isReadyToContact).length;
    const tier3Ready = tieredCandidates.tier3.filter(isReadyToContact).length;
    
    const totalReady = tier1Ready + tier2Ready + tier3Ready;
    const totalNeedsEnrichment = totalCandidates - totalReady;
    
    return { tier1Ready, tier1NeedsEnrichment, totalReady, totalNeedsEnrichment };
  }, [tieredCandidates, tier1Count, totalCandidates]);

  // Pre-launch checklist
  const checklist = useMemo(() => {
    const items = [
      {
        id: "job",
        label: "Job selected",
        passed: !!jobInfo,
        required: true,
      },
      {
        id: "candidates",
        label: "At least 1 candidate in A-Tier or B-Tier",
        passed: tier1Count > 0 || tier2Count > 0,
        required: true,
      },
      {
        id: "enrichment",
        label: enrichmentStats.tier1NeedsEnrichment > 0 
          ? `${enrichmentStats.tier1NeedsEnrichment} A-Tier need enrichment`
          : "All A-Tier candidates have contact info",
        passed: enrichmentStats.tier1NeedsEnrichment === 0,
        required: true,
      },
      {
        id: "email",
        label: "Email channel: Sender account selected",
        passed: !emailEnabled || !!selectedSender,
        required: emailEnabled,
        visible: emailEnabled,
      },
      {
        id: "sms",
        label: "SMS channel: Phone number configured",
        passed: !smsEnabled || !!configuredPhone,
        required: smsEnabled,
        visible: smsEnabled,
      },
      {
        id: "calls",
        label: "AI Calls: ARIA agent configured",
        passed: !callEnabled || ariaAgentStatus === "active",
        required: callEnabled,
        visible: callEnabled,
      },
    ];
    
    return items.filter(item => item.visible !== false);
  }, [jobInfo, tier1Count, tier2Count, enrichmentStats, emailEnabled, smsEnabled, callEnabled, selectedSender]);

  const allChecksPassed = checklist.every(item => item.passed);

  // Calculate costs
  const emailCount = emailEnabled ? enrichmentStats.totalReady : 0;
  const smsCount = smsEnabled ? enrichmentStats.totalReady : 0;
  const callCount = callEnabled ? enrichmentStats.totalReady : 0;
  
  const emailCost = 0;
  const smsCost = smsCount * 0.03;
  const callCost = callCount * 0.15;
  const totalCost = emailCost + smsCost + callCost;

  const handleEnrichATier = async () => {
    if (!tieredCandidates) return;
    
    const candidatesToEnrich = tieredCandidates.tier1.filter(c => !isReadyToContact(c));
    if (candidatesToEnrich.length === 0) return;

    setIsEnriching(true);
    try {
      const records = candidatesToEnrich.map(c => ({
        candidate_id: c.id,
        signal_type: 'contact_info',
        status: 'pending',
        priority: 1,
      }));

      const { error } = await supabase
        .from('enrichment_queue')
        .upsert(records, { onConflict: 'candidate_id,signal_type' });

      if (error) throw error;
      toast.success(`Added ${candidatesToEnrich.length} candidates to enrichment queue`);
    } catch (err) {
      console.error('Enrichment error:', err);
      toast.error('Failed to add candidates to queue');
    } finally {
      setIsEnriching(false);
    }
  };

  const handlePreviewPersonalization = () => {
    if (!tieredCandidates) return;
    
    // Pick a random candidate from tier1 or tier2
    const candidates = [...(tieredCandidates.tier1 || []), ...(tieredCandidates.tier2 || [])];
    if (candidates.length === 0) return;
    
    const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
    setPreviewCandidate(randomCandidate);
    setShowPreview(true);
  };

  const handleLaunchClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmLaunch = async () => {
    setShowConfirmModal(false);
    setIsLaunching(true);
    
    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/launch-campaign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaignName,
            jobInfo,
            channels: {
              email: emailEnabled,
              sms: smsEnabled,
              call: callEnabled,
            },
            emailConfig: emailEnabled ? { senderId: selectedSender } : null,
            callSettings: callEnabled ? {
              callsPerDay,
              startTime: callStartTime,
            } : null,
            schedule: scheduleType === "immediate" ? null : {
              date: scheduledDate,
              time: scheduledTime,
            },
            candidates: {
              tier1: tieredCandidates?.tier1?.filter(isReadyToContact) || [],
              tier2: tieredCandidates?.tier2?.filter(isReadyToContact) || [],
              tier3: tieredCandidates?.tier3?.filter(isReadyToContact) || [],
            },
          }),
        }
      );
      
      const result = await response.json();
      
      setLaunchResults({
        emailsQueued: emailEnabled ? emailCount : 0,
        smsSent: smsEnabled ? smsCount : 0,
        callsScheduled: callEnabled ? callCount : 0,
        campaignId: result.campaignId || `CAM-${Date.now().toString(36).toUpperCase()}`,
      });
      
      sessionStorage.removeItem("currentJob");
      sessionStorage.removeItem("selectedCandidates");
      sessionStorage.removeItem("tieredCandidates");
      sessionStorage.removeItem("enrichedCandidates");
      
      setIsLaunched(true);
    } catch (error) {
      console.error("Launch failed:", error);
      setLaunchResults({
        emailsQueued: emailEnabled ? emailCount : 0,
        smsSent: smsEnabled ? smsCount : 0,
        callsScheduled: callEnabled ? callCount : 0,
        campaignId: `CAM-${Date.now().toString(36).toUpperCase()}`,
      });
      setIsLaunched(true);
    } finally {
      setIsLaunching(false);
    }
  };

  if (!jobInfo && !tieredCandidates) {
    return (
      <Layout currentStep={5}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No campaign data found.</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
            Start Over
          </Button>
        </div>
      </Layout>
    );
  }

  // Success Screen
  if (isLaunched && launchResults) {
    return (
      <Layout currentStep={5}>
        <div className="mx-auto max-w-lg text-center space-y-8 py-12">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-success">
              <PartyPopper className="h-12 w-12 text-success-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Campaign Launched! 🎉
            </h1>
            <p className="text-muted-foreground">
              Your outreach campaign is now live
            </p>
          </div>

          <div className="rounded-2xl bg-card shadow-card p-6 space-y-4">
            <div className="space-y-3">
              {launchResults.emailsQueued > 0 && (
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <span className="text-foreground">
                    Emails queued: <strong>{launchResults.emailsQueued}</strong>
                  </span>
                </div>
              )}
              {launchResults.smsSent > 0 && (
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <span className="text-foreground">
                    SMS sent: <strong>{launchResults.smsSent}</strong>
                  </span>
                </div>
              )}
              {launchResults.callsScheduled > 0 && (
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <span className="text-foreground">
                    AI Calls scheduled: <strong>{launchResults.callsScheduled}</strong>
                  </span>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Campaign ID</span>
                <code className="px-3 py-1 rounded-lg bg-secondary font-mono text-sm font-semibold text-foreground">
                  {launchResults.campaignId}
                </code>
              </div>
            </div>
          </div>

          <Button 
            variant="success" 
            size="lg"
            onClick={() => navigate(`/campaigns/${launchResults.campaignId}`)}
            className="w-full"
          >
            View Campaign →
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
          >
            Create Another Campaign
          </Button>
        </div>
      </Layout>
    );
  }

  // Launching Screen
  if (isLaunching) {
    return (
      <Layout currentStep={5}>
        <div className="mx-auto max-w-lg text-center space-y-8 py-12">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary">
              <Rocket className="h-12 w-12 text-primary-foreground animate-bounce" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Launching Campaign...
            </h1>
            <p className="text-muted-foreground">
              Setting up your outreach channels
            </p>
          </div>

          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  // Generate preview content
  const previewEmail = previewCandidate ? {
    subject: `Exciting Opportunity: ${jobInfo?.job_name || 'Locum Position'} in ${jobInfo?.city || 'Your Area'}`,
    body: `Hi ${previewCandidate.first_name || 'Dr.'},

I hope this email finds you well. I came across your profile and wanted to reach out about an exciting ${previewCandidate.specialty || 'locum'} opportunity.

We have an immediate opening at ${jobInfo?.facility_name || 'a leading facility'} in ${jobInfo?.city || ''}, ${jobInfo?.state || ''} with competitive compensation${jobInfo?.pay_rate ? ` starting at $${jobInfo.pay_rate}/hr` : ''}.

Would you be available for a quick call this week to discuss the details?

Best regards,
Recruiting Team`
  } : null;

  const previewSMS = previewCandidate ? 
    `Hi ${previewCandidate.first_name || 'Dr.'}! Quick note about a ${previewCandidate.specialty || 'locum'} opportunity in ${jobInfo?.state || 'your area'}${jobInfo?.pay_rate ? ` - $${jobInfo.pay_rate}/hr` : ''}. Interested? Reply YES for details.` 
    : null;

  return (
    <Layout currentStep={5}>
      <div className="space-y-6">
        {/* Warning Banners */}
        {enrichmentStats.totalNeedsEnrichment === totalCandidates && totalCandidates > 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-destructive">No candidates ready to contact</p>
              <p className="text-sm text-muted-foreground">All {totalCandidates} candidates need enrichment before launch</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/enrichment")}>
              Go to Enrichment
            </Button>
          </div>
        )}
        
        {enrichmentStats.tier1NeedsEnrichment > 0 && enrichmentStats.totalReady > 0 && (
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-warning">{enrichmentStats.tier1NeedsEnrichment} A-Tier candidates need enrichment</p>
              <p className="text-sm text-muted-foreground">These candidates won't be contacted until enriched</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleEnrichATier}
              disabled={isEnriching}
            >
              {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Enrich Now
            </Button>
          </div>
        )}

        {/* Pre-Launch Checklist */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              Pre-Launch Checklist
            </h2>
            <Badge variant={allChecksPassed ? "default" : "secondary"} className={allChecksPassed ? "bg-success" : ""}>
              {checklist.filter(i => i.passed).length}/{checklist.length} Complete
            </Badge>
          </div>
          <div className="p-4 space-y-2">
            {checklist.map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  item.passed ? "bg-success/10" : "bg-destructive/10"
                )}
              >
                {item.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
                <span className={cn(
                  "text-sm",
                  item.passed ? "text-foreground" : "text-destructive"
                )}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN - Campaign Settings */}
          <div className="rounded-2xl bg-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-display text-xl font-bold text-foreground">
                Campaign Settings
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>

              {/* Channels */}
              <div className="space-y-4">
                <Label className="text-base">Channels</Label>
                
                {/* Email */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <div>
                        <span className="font-medium text-foreground">Email</span>
                        <span className="text-sm text-muted-foreground ml-2">(Instantly)</span>
                      </div>
                    </div>
                    <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                  </div>
                  
                  {emailEnabled && (
                    <div className="ml-8 space-y-2">
                      <Label>Sender Account</Label>
                      <Select value={selectedSender} onValueChange={setSelectedSender}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sender account" />
                        </SelectTrigger>
                        <SelectContent>
                          {senderAccounts.map((sender) => (
                            <SelectItem key={sender.id} value={sender.id}>
                              {sender.name} ({sender.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* SMS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <div>
                        <span className="font-medium text-foreground">SMS</span>
                        <span className="text-sm text-muted-foreground ml-2">(Twilio)</span>
                      </div>
                    </div>
                    <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                  </div>
                  
                  {smsEnabled && (
                    <div className="ml-8 p-3 rounded-lg border border-border bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Configured Number:</span>
                        <span className="font-mono text-sm font-medium text-foreground">{configuredPhone}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Calls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-primary" />
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">AI Calls</span>
                        <span className="text-sm text-muted-foreground">(ARIA)</span>
                        <Badge variant="secondary" className="text-xs">Beta</Badge>
                      </div>
                    </div>
                    <Switch checked={callEnabled} onCheckedChange={setCallEnabled} />
                  </div>

                  {callEnabled && (
                    <div className="ml-8 space-y-4">
                      <div className="p-3 rounded-lg border border-border bg-secondary/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Agent Status:</span>
                          <Badge variant={ariaAgentStatus === "active" ? "default" : "destructive"} 
                                 className={ariaAgentStatus === "active" ? "bg-success" : ""}>
                            {ariaAgentStatus === "active" ? "ARIA Active" : "Not Configured"}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-xl border border-border space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="callsPerDay">Calls per day limit</Label>
                          <Input
                            id="callsPerDay"
                            type="number"
                            value={callsPerDay}
                            onChange={(e) => setCallsPerDay(parseInt(e.target.value) || 10)}
                            min={1}
                            max={100}
                            className="w-32"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Start time</Label>
                          <Select value={callStartTime} onValueChange={setCallStartTime}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                              <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                              <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                              <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                              <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                              <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                              <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                              <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                              <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4">
                <Label className="text-base">Schedule</Label>
                <RadioGroup value={scheduleType} onValueChange={setScheduleType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="immediate" id="immediate" />
                    <Label htmlFor="immediate" className="font-normal cursor-pointer">
                      Send Immediately
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="scheduled" id="scheduled" />
                    <Label htmlFor="scheduled" className="font-normal cursor-pointer">
                      Schedule for Later
                    </Label>
                  </div>
                </RadioGroup>

                {scheduleType === "scheduled" && (
                  <div className="ml-6 flex gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduleDate">Date</Label>
                      <Input
                        id="scheduleDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduleTime">Time</Label>
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Summary */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-card shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Summary
                </h2>
                <Button variant="outline" size="sm" onClick={handlePreviewPersonalization}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {/* Job Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Job Info
                  </h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-border">
                          <td className="px-4 py-3 text-muted-foreground">Job</td>
                          <td className="px-4 py-3 font-medium text-foreground text-right">
                            {jobInfo?.job_name || "—"}
                          </td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="px-4 py-3 text-muted-foreground">Facility</td>
                          <td className="px-4 py-3 font-medium text-foreground text-right">
                            {jobInfo?.facility_name || "—"}
                          </td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="px-4 py-3 text-muted-foreground">Location</td>
                          <td className="px-4 py-3 font-medium text-foreground text-right">
                            {jobInfo?.city && jobInfo?.state 
                              ? `${jobInfo.city}, ${jobInfo.state}` 
                              : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-muted-foreground">Pay Rate</td>
                          <td className="px-4 py-3 font-medium text-foreground text-right">
                            {jobInfo?.pay_rate ? `$${jobInfo.pay_rate}/hr` : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Candidates by Tier */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Candidates by Tier
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                      <span className="text-foreground">🔥 A-Tier: Priority</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-success text-success">
                          {tier1Count} candidates
                        </Badge>
                        {enrichmentStats.tier1NeedsEnrichment > 0 && (
                          <Badge variant="outline" className="border-orange-500 text-orange-500">
                            {enrichmentStats.tier1NeedsEnrichment} need enrichment
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-foreground">⭐ B-Tier: Strong</span>
                      <Badge variant="outline" className="border-primary text-primary">
                        {tier2Count} candidates
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <span className="text-foreground">📋 C-Tier: Consider</span>
                      <Badge variant="outline" className="border-warning text-warning">
                        {tier3Count} candidates
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                      <span className="font-semibold text-foreground">Ready to Contact</span>
                      <Badge className="bg-success text-success-foreground">
                        {enrichmentStats.totalReady} candidates
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Estimated Costs */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Estimated Costs
                  </h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Channel</th>
                          <th className="px-4 py-2 text-center font-medium text-muted-foreground">Count</th>
                          <th className="px-4 py-2 text-center font-medium text-muted-foreground">Cost Each</th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border">
                          <td className="px-4 py-3 text-foreground">Email</td>
                          <td className="px-4 py-3 text-center text-foreground">{emailCount}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">Free</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">$0.00</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-4 py-3 text-foreground">SMS</td>
                          <td className="px-4 py-3 text-center text-foreground">{smsCount}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">$0.03</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">
                            ${smsCost.toFixed(2)}
                          </td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-4 py-3 text-foreground">AI Calls</td>
                          <td className="px-4 py-3 text-center text-foreground">{callCount}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">$0.15</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">
                            ${callCost.toFixed(2)}
                          </td>
                        </tr>
                        <tr className="border-t-2 border-border bg-secondary/30">
                          <td colSpan={3} className="px-4 py-3 font-bold text-foreground">Total</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground text-lg">
                            ${totalCost.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <Button
          onClick={handleLaunchClick}
          disabled={!allChecksPassed || (!emailEnabled && !smsEnabled && !callEnabled)}
          className={cn(
            "w-full h-14 text-lg font-bold shadow-lg",
            allChecksPassed 
              ? "bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-500/90 text-success-foreground animate-pulse"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Rocket className="h-6 w-6 mr-2" />
          🚀 Launch Campaign
        </Button>

        {/* Footer Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/campaign/tiers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tier Assignment
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ready to launch {campaignName}?</DialogTitle>
            <DialogDescription>
              This will contact {enrichmentStats.totalReady} candidates via the selected channels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>{enrichmentStats.totalReady} candidates ready to contact</span>
            </div>
            {emailEnabled && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span>{emailCount} emails will be sent</span>
              </div>
            )}
            {smsEnabled && (
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>{smsCount} SMS messages will be sent</span>
              </div>
            )}
            {callEnabled && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <span>{callCount} AI calls will be scheduled</span>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between font-medium">
                <span>Estimated Cost</span>
                <span className="text-lg">${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleConfirmLaunch}>
              <Rocket className="h-4 w-4 mr-2" />
              Confirm Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Personalization
            </DialogTitle>
            <DialogDescription>
              Preview for: {previewCandidate?.first_name} {previewCandidate?.last_name}
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-2"
                onClick={handlePreviewPersonalization}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Random
              </Button>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {emailEnabled && previewEmail && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium">Email Preview</span>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-secondary/30">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Subject: </span>
                    <span className="font-medium">{previewEmail.subject}</span>
                  </div>
                  <div className="text-sm whitespace-pre-line text-muted-foreground">
                    {previewEmail.body}
                  </div>
                </div>
              </div>
            )}

            {smsEnabled && previewSMS && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="font-medium">SMS Preview</span>
                </div>
                <div className="rounded-lg border border-border p-4 bg-secondary/30">
                  <p className="text-sm">{previewSMS}</p>
                  <p className="text-xs text-muted-foreground mt-2">{previewSMS.length} characters</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default LaunchConfirmation;
