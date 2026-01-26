import { useState } from "react";
import { FlaskConical, Mail, MessageSquare, Phone, Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { SelectedCandidate, ChannelConfig, Job } from "./types";

interface TestCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  candidates: SelectedCandidate[];
  channels: ChannelConfig;
  senderEmail: string;
  campaignName: string;
}

interface SequenceStep {
  day: number;
  channel: "email" | "sms" | "call";
  subject?: string;
  content: string;
  angle?: string;
}

export function TestCampaignModal({
  open,
  onOpenChange,
  job,
  candidates,
  channels,
  senderEmail,
  campaignName,
}: TestCampaignModalProps) {
  const { user } = useAuth();
  const [testEmail, setTestEmail] = useState(user?.email || "");
  const [testPhone, setTestPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSMS, setSendSMS] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [activeTab, setActiveTab] = useState("preview");

  // Get preview candidate (first one with personalization)
  const previewCandidate = candidates.find(c => c.icebreaker || c.email_body) || candidates[0];

  // Generate sequence preview based on channels
  const generateSequencePreview = (): SequenceStep[] => {
    const steps: SequenceStep[] = [];
    
    if (channels.email) {
      // Day 1 - Initial Email
      steps.push({
        day: 1,
        channel: "email",
        subject: previewCandidate?.email_subject || `${job?.specialty || "Locums"} Opportunity - ${job?.facility_name || "Facility"}`,
        content: previewCandidate?.email_body || generateFallbackEmail(1),
        angle: "Connection-First Opening",
      });

      // Day 3 - Clinical Scope
      steps.push({
        day: 3,
        channel: "email",
        subject: `Quick follow-up: ${job?.specialty || "Position"} details`,
        content: generateFollowupEmail(3, "Clinical Scope"),
        angle: "Clinical Scope - 'What will I do?'",
      });

      // Day 5 - Lifestyle
      steps.push({
        day: 5,
        channel: "email",
        subject: `Re: ${job?.facility_name || "Facility"} opportunity`,
        content: generateFollowupEmail(5, "Lifestyle"),
        angle: "Lifestyle - 'Will it fit my life?'",
      });

      // Day 7 - Curiosity
      steps.push({
        day: 7,
        channel: "email",
        subject: `Still available: ${job?.state || ""} ${job?.specialty || "locums"}`,
        content: generateFollowupEmail(7, "Curiosity"),
        angle: "Curiosity - 'Am I missing something?'",
      });

      // Day 14 - Breakup
      steps.push({
        day: 14,
        channel: "email",
        subject: `Closing the loop on ${job?.facility_name || "opportunity"}`,
        content: generateFollowupEmail(14, "Breakup"),
        angle: "Breakup/Resource - 'Can this person help me later?'",
      });
    }

    if (channels.sms) {
      steps.push({
        day: 1,
        channel: "sms",
        content: previewCandidate?.sms_message || `Dr. ${previewCandidate?.last_name || "Smith"}, ${job?.specialty || "locums"} role in ${job?.state || "CA"} - $${job?.pay_rate || job?.hourly_rate || "500"}/hr. Quick call this week?`,
      });
    }

    if (channels.aiCall) {
      steps.push({
        day: channels.aiCall.callDay || 10,
        channel: "call",
        content: `AI-powered outreach call to introduce ${job?.specialty || "opportunity"} at ${job?.facility_name || "facility"}.`,
      });
    }

    return steps.sort((a, b) => a.day - b.day);
  };

  const generateFallbackEmail = (day: number): string => {
    const firstName = previewCandidate?.first_name || "Doctor";
    const lastName = previewCandidate?.last_name || "";
    const specialty = job?.specialty || "locums";
    const facility = job?.facility_name || "facility";
    const rate = job?.pay_rate || job?.hourly_rate || job?.bill_rate;

    return `Dr. ${lastName},

I came across your profile and noticed your background in ${specialty}. We have an immediate opening at ${facility} that I thought might align with your practice.

${rate ? `The role offers $${rate}/hr` : "Competitive compensation"} with a flexible schedule.

Would you have 10 minutes this week for a quick call?

Best,
[Your Name]
Locums One`;
  };

  const generateFollowupEmail = (day: number, angle: string): string => {
    const lastName = previewCandidate?.last_name || "Smith";
    const specialty = job?.specialty || "locums";
    const facility = job?.facility_name || "facility";
    const rate = job?.pay_rate || job?.hourly_rate;

    const templates: Record<string, string> = {
      "Clinical Scope": `Dr. ${lastName},

Following up on my previous note about ${facility}. I wanted to share more about the clinical scope:

• Full ${specialty} coverage with support staff
• Modern equipment and EMR system
• Typical patient volume: 15-20/day

${rate ? `Rate: $${rate}/hr` : ""}

Happy to discuss the specifics whenever works for you.

Best,
[Your Name]`,
      "Lifestyle": `Dr. ${lastName},

I understand schedule flexibility is important. This ${specialty} role at ${facility} offers:

• Choose your own dates
• No call requirement
• Housing/travel covered

Let me know if this fits what you're looking for.

Best,
[Your Name]`,
      "Curiosity": `Dr. ${lastName},

Quick note - still have availability at ${facility} for ${specialty} coverage. 

A few colleagues have already expressed interest. If you'd like me to hold any dates, just let me know.

Best,
[Your Name]`,
      "Breakup": `Dr. ${lastName},

I'll close the loop on the ${specialty} opportunity at ${facility}. 

If timing isn't right now, no problem - I'm happy to be a resource for future locums needs. Feel free to reach out anytime.

Best,
[Your Name]`,
    };

    return templates[angle] || templates["Clinical Scope"];
  };

  const sequenceSteps = generateSequencePreview();

  const handleSendTest = async () => {
    if (!testEmail && sendEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a test email address.",
        variant: "destructive",
      });
      return;
    }

    if (!testPhone && sendSMS) {
      toast({
        title: "Phone Required",
        description: "Please enter a test phone number for SMS.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setSendStatus("sending");

    try {
      // Send test campaign via edge function
      const { data, error } = await supabase.functions.invoke("send-test-campaign", {
        body: {
          test_email: sendEmail ? testEmail : null,
          test_phone: sendSMS ? testPhone : null,
          campaign_name: campaignName,
          job,
          sequence_steps: sequenceSteps,
          sender_email: senderEmail,
        },
      });

      if (error) throw error;

      setSendStatus("success");
      toast({
        title: "Test Campaign Sent!",
        description: `Check ${sendEmail ? testEmail : ""} ${sendEmail && sendSMS ? "and" : ""} ${sendSMS ? testPhone : ""} for the test messages.`,
      });

      // Close after delay
      setTimeout(() => {
        onOpenChange(false);
        setSendStatus("idle");
      }, 2000);
    } catch (err) {
      console.error("Test campaign failed:", err);
      setSendStatus("error");
      toast({
        title: "Test Failed",
        description: "Could not send test campaign. The preview is still available above.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getChannelIcon = (channel: "email" | "sms" | "call") => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: "email" | "sms" | "call") => {
    switch (channel) {
      case "email":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "sms":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "call":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FlaskConical className="h-5 w-5 text-amber-400" />
            Test Campaign Mode
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Preview and send the full sequence to yourself before launching to candidates.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview Sequence</TabsTrigger>
            <TabsTrigger value="send">Send Test</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {sequenceSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-border bg-muted/20"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getChannelColor(step.channel)}>
                          {getChannelIcon(step.channel)}
                          <span className="ml-1 capitalize">{step.channel}</span>
                        </Badge>
                        <span className="text-sm font-medium text-foreground">Day {step.day}</span>
                      </div>
                      {step.angle && (
                        <span className="text-xs text-muted-foreground italic">{step.angle}</span>
                      )}
                    </div>

                    {step.subject && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Subject: </span>
                        <span className="text-sm font-medium text-foreground">{step.subject}</span>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded border border-border/50">
                      {step.content}
                    </div>
                  </div>
                ))}

                {sequenceSteps.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No channels configured for this campaign.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="send" className="mt-4 space-y-6">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <FlaskConical className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Test Mode</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will send all {sequenceSteps.length} touchpoints to your test addresses immediately, 
                    allowing you to review the full sequence before launching to real candidates.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-400" />
                  <div>
                    <Label htmlFor="send-email" className="text-sm font-medium">Send Test Emails</Label>
                    <p className="text-xs text-muted-foreground">
                      {sequenceSteps.filter(s => s.channel === "email").length} email touchpoints
                    </p>
                  </div>
                </div>
                <Switch
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  disabled={!channels.email}
                />
              </div>

              {sendEmail && (
                <div className="pl-8">
                  <Label htmlFor="test-email" className="text-sm text-muted-foreground">
                    Test Email Address
                  </Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>
              )}

              {/* SMS Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-emerald-400" />
                  <div>
                    <Label htmlFor="send-sms" className="text-sm font-medium">Send Test SMS</Label>
                    <p className="text-xs text-muted-foreground">
                      {sequenceSteps.filter(s => s.channel === "sms").length} SMS touchpoints
                    </p>
                  </div>
                </div>
                <Switch
                  id="send-sms"
                  checked={sendSMS}
                  onCheckedChange={setSendSMS}
                  disabled={!channels.sms}
                />
              </div>

              {sendSMS && (
                <div className="pl-8">
                  <Label htmlFor="test-phone" className="text-sm text-muted-foreground">
                    Test Phone Number
                  </Label>
                  <Input
                    id="test-phone"
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {sendStatus === "success" && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-emerald-400">Test campaign sent successfully!</span>
              </div>
            )}

            {sendStatus === "error" && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <span className="text-sm text-red-400">Failed to send test campaign. Check console for details.</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {activeTab === "send" && (
            <Button
              onClick={handleSendTest}
              disabled={isSending || (!sendEmail && !sendSMS) || sendStatus === "success"}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500/90 hover:to-orange-500/90"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Campaign
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
