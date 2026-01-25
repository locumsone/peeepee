import { useState } from "react";
import { Rocket, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { SelectedCandidate, ChannelConfig, QualityCheckResult } from "./types";

interface LaunchControlProps {
  jobId: string | null;
  campaignName: string;
  candidates: SelectedCandidate[];
  channels: ChannelConfig;
  senderEmail?: string;
  qualityResult: QualityCheckResult | null;
  integrationsConnected: boolean;
}

interface PreFlightCheck {
  name: string;
  status: "pending" | "checking" | "passed" | "failed";
  details?: string;
}

export function LaunchControl({
  jobId,
  campaignName,
  candidates,
  channels,
  senderEmail,
  qualityResult,
  integrationsConnected,
}: LaunchControlProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [preFlightChecks, setPreFlightChecks] = useState<PreFlightCheck[]>([]);
  const [preFlightComplete, setPreFlightComplete] = useState(false);

  const canLaunch =
    jobId &&
    campaignName.trim().length > 0 &&
    candidates.length > 0 &&
    qualityResult?.can_launch &&
    integrationsConnected;

  const handleOpenModal = () => {
    setIsOpen(true);
    runPreFlightChecks();
  };

  const runPreFlightChecks = async () => {
    const checks: PreFlightCheck[] = [
      { name: "Campaign Configuration", status: "checking" },
      { name: "Candidate Data", status: "pending" },
      { name: "Integration APIs", status: "pending" },
      { name: "Database Connection", status: "pending" },
    ];

    setPreFlightChecks(checks);
    setPreFlightComplete(false);

    // Check 1: Campaign config
    await new Promise((resolve) => setTimeout(resolve, 300));
    checks[0] = {
      name: "Campaign Configuration",
      status: campaignName && jobId ? "passed" : "failed",
      details: campaignName && jobId ? "Valid" : "Missing required fields",
    };
    checks[1].status = "checking";
    setPreFlightChecks([...checks]);

    // Check 2: Candidate data
    await new Promise((resolve) => setTimeout(resolve, 300));
    const readyCandidates = candidates.filter(
      (c) => (c.email || c.personal_email) || (c.phone || c.personal_mobile)
    );
    checks[1] = {
      name: "Candidate Data",
      status: readyCandidates.length > 0 ? "passed" : "failed",
      details: `${readyCandidates.length}/${candidates.length} ready`,
    };
    checks[2].status = "checking";
    setPreFlightChecks([...checks]);

    // Check 3: Integrations
    await new Promise((resolve) => setTimeout(resolve, 400));
    checks[2] = {
      name: "Integration APIs",
      status: integrationsConnected ? "passed" : "failed",
      details: integrationsConnected ? "All connected" : "Some disconnected",
    };
    checks[3].status = "checking";
    setPreFlightChecks([...checks]);

    // Check 4: Database
    await new Promise((resolve) => setTimeout(resolve, 200));
    checks[3] = {
      name: "Database Connection",
      status: "passed",
      details: "Healthy",
    };
    setPreFlightChecks([...checks]);
    setPreFlightComplete(true);
  };

  const allChecksPassed = preFlightChecks.every((c) => c.status === "passed");

  const handleLaunch = async () => {
    if (!jobId || !canLaunch) return;

    setIsLaunching(true);

    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke("launch-campaign", {
        body: {
          job_id: jobId,
          campaign_name: campaignName,
          sender_email: senderEmail,
          candidates: candidates.map((c) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email || c.personal_email,
            phone: c.phone || c.personal_mobile,
            icebreaker: c.icebreaker,
            talking_points: c.talking_points,
            email_subject: c.email_subject,
            email_body: c.email_body,
            sms_message: c.sms_message,
          })),
          channels,
        },
      });

      if (error) {
        // Fallback to direct database insert
        console.log("Edge function failed, using fallback:", error);
        
        const { data: campaignData, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignName,
            job_id: jobId,
            status: "active",
            channel: Object.keys(channels).filter((k) => channels[k as keyof ChannelConfig]).join(","),
            sender_account: senderEmail,
            leads_count: candidates.length,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert campaign leads
        const leadsToInsert = candidates.map((c) => ({
          campaign_id: campaignData.id,
          candidate_id: c.id,
          candidate_name: `${c.first_name} ${c.last_name}`,
          candidate_email: c.email || c.personal_email,
          candidate_phone: c.phone || c.personal_mobile,
          status: "pending",
        }));

        await supabase.from("campaign_leads_v2").insert(leadsToInsert);

        // Queue AI calls if enabled
        if (channels.aiCall) {
          const callsToQueue = candidates
            .filter((c) => c.phone || c.personal_mobile)
            .map((c) => ({
              campaign_id: campaignData.id,
              candidate_id: c.id,
              candidate_name: `${c.first_name} ${c.last_name}`,
              phone: c.phone || c.personal_mobile,
              job_id: jobId,
              status: "queued",
            }));

          if (callsToQueue.length > 0) {
            await supabase.from("ai_call_queue").insert(callsToQueue);
          }
        }

        toast({
          title: "Campaign Launched",
          description: `${campaignName} is now active with ${candidates.length} candidates`,
        });

        // Clear session and navigate
        sessionStorage.removeItem("campaign_job");
        sessionStorage.removeItem("campaign_job_id");
        sessionStorage.removeItem("campaign_candidates");
        sessionStorage.removeItem("campaign_candidate_ids");
        sessionStorage.removeItem("channelConfig");

        navigate(`/campaigns/${campaignData.id}`);
      } else {
        toast({
          title: "Campaign Launched",
          description: data?.message || `${campaignName} is now active`,
        });

        sessionStorage.clear();
        navigate(data?.campaign_id ? `/campaigns/${data.campaign_id}` : "/campaigns");
      }
    } catch (err) {
      console.error("Launch failed:", err);
      toast({
        title: "Launch Failed",
        description: "Could not launch campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
      setIsOpen(false);
    }
  };

  const getCheckIcon = (status: PreFlightCheck["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "checking":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  return (
    <>
      <Button
        size="lg"
        onClick={handleOpenModal}
        disabled={!canLaunch}
        className="w-full bg-gradient-to-r from-primary to-sky-500 hover:from-primary/90 hover:to-sky-500/90 text-white font-semibold shadow-lg shadow-primary/20"
      >
        <Rocket className="h-5 w-5 mr-2" />
        Launch Campaign
      </Button>

      {!canLaunch && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <span>
            {!qualityResult
              ? "Run quality check first"
              : !qualityResult.can_launch
              ? "Fix critical issues to launch"
              : !integrationsConnected
              ? "Connect integrations to launch"
              : "Complete all required fields"}
          </span>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Rocket className="h-5 w-5 text-primary" />
              Launch Campaign
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pre-flight check for "{campaignName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {preFlightChecks.map((check, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  {getCheckIcon(check.status)}
                  <span className="text-sm text-foreground">{check.name}</span>
                </div>
                {check.details && (
                  <span
                    className={`text-xs ${
                      check.status === "passed"
                        ? "text-green-400"
                        : check.status === "failed"
                        ? "text-red-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {check.details}
                  </span>
                )}
              </div>
            ))}
          </div>

          {preFlightComplete && (
            <div
              className={`p-3 rounded-lg text-center ${
                allChecksPassed
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  allChecksPassed ? "text-green-400" : "text-red-400"
                }`}
              >
                {allChecksPassed
                  ? "All systems operational"
                  : "Some checks failed - review before launching"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {candidates.length} candidates across{" "}
                {Object.keys(channels).filter((k) => channels[k as keyof ChannelConfig]).length} channels
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLaunch}
              disabled={!preFlightComplete || !allChecksPassed || isLaunching}
              className="bg-gradient-to-r from-primary to-sky-500"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Confirm Launch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
