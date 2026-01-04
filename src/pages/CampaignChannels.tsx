import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ArrowLeft, ArrowRight, Mail, MessageSquare, Phone, Linkedin, CalendarIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Channels" },
  { number: 4, label: "Review" },
];

const senderOptions = [
  "rainey@trylocumsone.com",
  "parker@trylocumsone.com",
  "gio@trylocumsone.com",
  "ali@trylocumsone.com",
  "info@locums.one",
];

const recruiterOptions = [
  { value: "rainey", label: "Rainey" },
  { value: "parker", label: "Parker" },
  { value: "gio", label: "Gio" },
  { value: "ali", label: "Ali" },
];

const timeOptions = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM",
];

const timezoneOptions = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
];

export default function CampaignChannels() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobName, setJobName] = useState("");
  const [candidateCount, setCandidateCount] = useState(0);

  // Channel states
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSender, setEmailSender] = useState(senderOptions[0]);
  const [emailSequence, setEmailSequence] = useState("4");
  const [emailGap, setEmailGap] = useState("3");

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSequence, setSmsSequence] = useState("2");

  const [aiCallEnabled, setAiCallEnabled] = useState(false);
  const [callTiming, setCallTiming] = useState("1");
  const [transferTo, setTransferTo] = useState("rainey");

  const [linkedinEnabled, setLinkedinEnabled] = useState(false);

  // Schedule states
  const [startDate, setStartDate] = useState<Date>(addDays(new Date(), 1));
  const [sendWindowStart, setSendWindowStart] = useState("9:00 AM");
  const [sendWindowEnd, setSendWindowEnd] = useState("5:00 PM");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);

  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates");

    if (!storedJobId || !storedCandidates) {
      navigate("/campaigns/new");
      return;
    }

    setJobId(storedJobId);
    const candidates = JSON.parse(storedCandidates);
    setCandidateCount(candidates.length);

    // Fetch job name
    const fetchJob = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("job_name, facility_name")
        .eq("id", storedJobId)
        .single();
      
      if (data) {
        setJobName(data.job_name || data.facility_name || "Untitled Job");
      }
    };

    fetchJob();
  }, [navigate]);

  const hasChannelEnabled = emailEnabled || smsEnabled || aiCallEnabled || linkedinEnabled;

  const handleExportLinkedIn = async () => {
    const storedCandidates = sessionStorage.getItem("campaign_candidates");
    if (!storedCandidates) return;

    const candidateIds = JSON.parse(storedCandidates);
    
    const { data: candidates } = await supabase
      .from("candidates")
      .select("first_name, last_name, email, specialty, city, state, company_name")
      .in("id", candidateIds);

    if (!candidates || candidates.length === 0) {
      toast.error("No candidates found");
      return;
    }

    // Create CSV
    const headers = ["First Name", "Last Name", "Email", "Specialty", "City", "State", "Company"];
    const rows = candidates.map(c => [
      c.first_name || "",
      c.last_name || "",
      c.email || "",
      c.specialty || "",
      c.city || "",
      c.state || "",
      c.company_name || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkedin-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exported for AIMFOX");
  };

  const handleNext = () => {
    const config = {
      email: emailEnabled ? {
        sender: emailSender,
        sequenceLength: parseInt(emailSequence),
        gapDays: parseInt(emailGap),
      } : null,
      sms: smsEnabled ? {
        fromNumber: "+12185628671",
        sequenceLength: parseInt(smsSequence),
      } : null,
      aiCall: aiCallEnabled ? {
        fromNumber: "+13055634142",
        callDay: parseInt(callTiming),
        transferTo,
      } : null,
      linkedin: linkedinEnabled,
      schedule: {
        startDate: startDate.toISOString(),
        sendWindowStart,
        sendWindowEnd,
        timezone,
        weekdaysOnly,
      },
    };

    // Save channel config in both formats for compatibility
    sessionStorage.setItem("campaign_channels", JSON.stringify(config));
    sessionStorage.setItem("channelConfig", JSON.stringify({
      email: { enabled: emailEnabled, sender: emailSender, sequenceCount: parseInt(emailSequence) },
      sms: { enabled: smsEnabled, sequenceCount: parseInt(smsSequence) },
      aiCalls: { enabled: aiCallEnabled, callDay: parseInt(callTiming) },
      linkedin: { enabled: linkedinEnabled },
      schedule: { 
        startDate: startDate.toISOString(), 
        startTime: sendWindowStart, 
        endTime: sendWindowEnd, 
        timezone, 
        weekdaysOnly 
      }
    }));
    navigate("/campaigns/new/review");
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <StepIndicator currentStep={3} steps={steps} />

          {/* Summary Bar */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
            <p className="text-sm text-foreground">
              Campaign for <span className="font-semibold text-primary">{jobName}</span> with{" "}
              <span className="font-semibold">{candidateCount}</span> candidates selected
            </p>
          </div>

          {/* Channel Cards */}
          <div className="space-y-4">
            {/* Email Channel */}
            <Card className={cn(
              "transition-all duration-300",
              emailEnabled && "ring-2 ring-primary/50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Email</CardTitle>
                      <p className="text-sm text-muted-foreground">via Instantly</p>
                    </div>
                  </div>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>
              </CardHeader>
              {emailEnabled && (
                <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Sender</Label>
                      <Select value={emailSender} onValueChange={setEmailSender}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {senderOptions.map(sender => (
                            <SelectItem key={sender} value={sender}>{sender}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sequence Length</Label>
                      <Select value={emailSequence} onValueChange={setEmailSequence}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 emails</SelectItem>
                          <SelectItem value="4">4 emails</SelectItem>
                          <SelectItem value="5">5 emails</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Days Between Emails</Label>
                    <Select value={emailGap} onValueChange={setEmailGap}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 days</SelectItem>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="5">5 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Emails personalized by Sherlock Meowmes 🐱
                  </p>
                </CardContent>
              )}
            </Card>

            {/* SMS Channel */}
            <Card className={cn(
              "transition-all duration-300",
              smsEnabled && "ring-2 ring-primary/50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">SMS</CardTitle>
                      <p className="text-sm text-muted-foreground">via Twilio</p>
                    </div>
                  </div>
                  <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                </div>
              </CardHeader>
              {smsEnabled && (
                <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label>From Number</Label>
                    <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">+1 (218) 562-8671</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sequence</Label>
                    <Select value={smsSequence} onValueChange={setSmsSequence}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 texts</SelectItem>
                        <SelectItem value="3">3 texts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    SMS sends on Day 2, 5, 10 of campaign
                  </p>
                </CardContent>
              )}
            </Card>

            {/* AI Calls Channel */}
            <Card className={cn(
              "transition-all duration-300",
              aiCallEnabled && "ring-2 ring-primary/50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Phone className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">AI Calls</CardTitle>
                      <p className="text-sm text-muted-foreground">via ARIA</p>
                    </div>
                  </div>
                  <Switch checked={aiCallEnabled} onCheckedChange={setAiCallEnabled} />
                </div>
              </CardHeader>
              {aiCallEnabled && (
                <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    ARIA calls from +1 (305) 563-4142
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Call Timing</Label>
                      <Select value={callTiming} onValueChange={setCallTiming}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Day 1</SelectItem>
                          <SelectItem value="2">Day 2</SelectItem>
                          <SelectItem value="3">Day 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Transfer To</Label>
                      <Select value={transferTo} onValueChange={setTransferTo}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {recruiterOptions.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Interested candidates transfer live to recruiter
                  </p>
                </CardContent>
              )}
            </Card>

            {/* LinkedIn Channel */}
            <Card className={cn(
              "transition-all duration-300",
              linkedinEnabled && "ring-2 ring-primary/50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-sky-500/10">
                      <Linkedin className="h-5 w-5 text-sky-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">LinkedIn</CardTitle>
                      <p className="text-sm text-muted-foreground">Manual</p>
                    </div>
                  </div>
                  <Switch checked={linkedinEnabled} onCheckedChange={setLinkedinEnabled} />
                </div>
              </CardHeader>
              {linkedinEnabled && (
                <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-sm text-muted-foreground">
                    LinkedIn outreach is sent manually
                  </p>
                  <Button variant="outline" onClick={handleExportLinkedIn} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export for AIMFOX
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Schedule Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Send Window Start</Label>
                  <Select value={sendWindowStart} onValueChange={setSendWindowStart}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Send Window End</Label>
                  <Select value={sendWindowEnd} onValueChange={setSendWindowEnd}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="weekdays"
                  checked={weekdaysOnly}
                  onCheckedChange={(checked) => setWeekdaysOnly(checked as boolean)}
                />
                <Label htmlFor="weekdays" className="cursor-pointer">Weekdays only</Label>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/campaigns/new/candidates")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Candidates
            </Button>
            <Button
              onClick={handleNext}
              disabled={!hasChannelEnabled}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              Next: Review & Launch
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
