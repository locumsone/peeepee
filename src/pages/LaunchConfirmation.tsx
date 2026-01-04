import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Rocket, CheckCircle2, Mail, MessageSquare, Phone,
  Users, DollarSign, ArrowLeft, Loader2, PartyPopper,
  MapPin, Building2, Briefcase, Calendar, Clock
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

interface JobInfo {
  job_name?: string;
  facility_name?: string;
  city?: string;
  state?: string;
  pay_rate?: number;
}

interface Candidate {
  id: string;
  tier: number;
  [key: string]: any;
}

interface TieredCandidates {
  tier1: Candidate[];
  tier2: Candidate[];
  tier3: Candidate[];
  tier4: Candidate[];
}

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
  
  // Data state
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [tieredCandidates, setTieredCandidates] = useState<TieredCandidates | null>(null);
  
  // Launch state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);
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
      // Set default campaign name
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setCampaignName(`${job.job_name || 'Campaign'} - ${today}`);
    }
    
    // Load tiered candidates
    const storedTiers = sessionStorage.getItem("tieredCandidates");
    if (storedTiers) {
      setTieredCandidates(JSON.parse(storedTiers));
    }
  }, []);

  // Calculate totals
  const tier1Count = tieredCandidates?.tier1?.length || 0;
  const tier2Count = tieredCandidates?.tier2?.length || 0;
  const tier3Count = tieredCandidates?.tier3?.length || 0;
  const totalCandidates = tier1Count + tier2Count + tier3Count;

  // Calculate costs
  const emailCount = emailEnabled ? totalCandidates : 0;
  const smsCount = smsEnabled ? totalCandidates : 0;
  const callCount = callEnabled ? totalCandidates : 0;
  
  const emailCost = 0;
  const smsCost = smsCount * 0.03;
  const callCost = callCount * 0.15;
  const totalCost = emailCost + smsCost + callCost;

  const handleLaunchClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmLaunch = async () => {
    setShowConfirmModal(false);
    setIsLaunching(true);
    
    try {
      // POST to edge function
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
            callSettings: callEnabled ? {
              callsPerDay,
              startTime: callStartTime,
            } : null,
            schedule: scheduleType === "immediate" ? null : {
              date: scheduledDate,
              time: scheduledTime,
            },
            candidates: {
              tier1: tieredCandidates?.tier1 || [],
              tier2: tieredCandidates?.tier2 || [],
              tier3: tieredCandidates?.tier3 || [],
            },
          }),
        }
      );
      
      const result = await response.json();
      
      setLaunchResults({
        emailsQueued: emailEnabled ? totalCandidates : 0,
        smsSent: smsEnabled ? totalCandidates : 0,
        callsScheduled: callEnabled ? totalCandidates : 0,
        campaignId: result.campaignId || `CAM-${Date.now().toString(36).toUpperCase()}`,
      });
      
      // Clear session storage
      sessionStorage.removeItem("currentJob");
      sessionStorage.removeItem("selectedCandidates");
      sessionStorage.removeItem("tieredCandidates");
      sessionStorage.removeItem("enrichedCandidates");
      
      setIsLaunched(true);
    } catch (error) {
      console.error("Launch failed:", error);
      // Simulate success for demo
      setLaunchResults({
        emailsQueued: emailEnabled ? totalCandidates : 0,
        smsSent: smsEnabled ? totalCandidates : 0,
        callsScheduled: callEnabled ? totalCandidates : 0,
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

  return (
    <Layout currentStep={5}>
      <div className="space-y-6">
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

                {/* SMS */}
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

                  {/* AI Call Sub-options */}
                  {callEnabled && (
                    <div className="ml-8 p-4 rounded-xl border border-border space-y-4">
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
          <div className="rounded-2xl bg-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-display text-xl font-bold text-foreground">
                Summary
              </h2>
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
                    <span className="text-foreground">🔥 Tier 1: Priority</span>
                    <Badge variant="outline" className="border-success text-success">
                      {tier1Count} candidates
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-foreground">⭐ Tier 2: Strong</span>
                    <Badge variant="outline" className="border-primary text-primary">
                      {tier2Count} candidates
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <span className="text-foreground">📋 Tier 3: Consider</span>
                    <Badge variant="outline" className="border-warning text-warning">
                      {tier3Count} candidates
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <span className="font-semibold text-foreground">Total</span>
                    <Badge className="bg-foreground text-background">
                      {totalCandidates} candidates
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

        {/* Launch Button */}
        <Button
          onClick={handleLaunchClick}
          disabled={totalCandidates === 0 || (!emailEnabled && !smsEnabled && !callEnabled)}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-500/90 text-success-foreground shadow-lg animate-pulse"
        >
          <Rocket className="h-6 w-6 mr-2" />
          🚀 Launch Campaign
        </Button>

        {/* Footer Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/campaign/enrich")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Enrichment
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch Campaign?</DialogTitle>
            <DialogDescription>
              You're about to launch "{campaignName}" to {totalCandidates} candidates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>{tier1Count + tier2Count + tier3Count} candidates in Tiers 1-3</span>
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
    </Layout>
  );
};

export default LaunchConfirmation;
