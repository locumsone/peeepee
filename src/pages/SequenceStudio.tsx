import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  ArrowLeft, ArrowRight, Mail, MessageSquare, Phone, Linkedin,
  Sparkles, RefreshCw, Copy, ChevronDown, ChevronUp,
  Users, Zap, Clock, CheckCircle2, AlertTriangle, Eye, Edit3,
  Layers, Calendar, Settings, Target
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Sequence" },
  { number: 4, label: "Review" },
];

const senderAccounts = [
  {
    group: "Rainey Morris",
    emails: ["rainey@locums.one", "rainey@trylocumsone.com", "rainey@meetlocumsone.com"],
  },
  {
    group: "Parker Spring",
    emails: ["parker@locums.one", "parker@trylocumsone.com", "parker@meetlocumsone.com"],
  },
  {
    group: "Ali Mussabayev",
    emails: ["ali@trylocumsone.com", "ali@meetlocumsone.com", "ali@teamlocumsone.com"],
  },
  {
    group: "Gio D'Alesio",
    emails: ["gio@locums.one", "gio@trylocumsone.com", "gio@meetlocumsone.com"],
  },
];

const smsStyles = [
  { value: "punchy", label: "⚡ Punchy", description: "Short & impactful" },
  { value: "friendly", label: "😊 Friendly", description: "Warm & conversational" },
  { value: "urgent", label: "🔥 Urgent", description: "Creates FOMO" },
  { value: "value_prop", label: "💰 Value-First", description: "Lead with money" },
];

const emailTypes = [
  { value: "initial", label: "📧 Initial Outreach" },
  { value: "followup", label: "🔄 Follow-up" },
  { value: "value_prop", label: "💰 Value Proposition" },
  { value: "fellowship", label: "🎓 Fellowship-Focused" },
];

interface Job {
  id: string;
  job_name?: string;
  facility_name?: string;
  specialty?: string;
  city?: string;
  state?: string;
  bill_rate?: number;
  pay_rate?: number;
}

interface SelectedCandidate {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  personal_mobile?: string;
  personalization_hook?: string;
  icebreaker?: string;
  talking_points?: string[];
}

interface SequenceStep {
  day: number;
  channel: 'email' | 'sms' | 'call' | 'linkedin';
  content?: string;
  subject?: string;
  generated?: boolean;
}

export default function SequenceStudio() {
  const navigate = useNavigate();
  
  // Data from sessionStorage
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<SelectedCandidate[]>([]);
  
  // Channel configuration
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [aiCallEnabled, setAiCallEnabled] = useState(false);
  const [linkedinEnabled, setLinkedinEnabled] = useState(false);
  
  // Email settings
  const [emailSender, setEmailSender] = useState(senderAccounts[0].emails[0]);
  const [emailSequenceCount, setEmailSequenceCount] = useState(4);
  
  // SMS settings
  const [smsStyle, setSmsStyle] = useState<string>("punchy");
  const [smsSequenceCount, setSmsSequenceCount] = useState(2);
  
  // Generated content
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsMessages, setSmsMessages] = useState<string[]>([]);
  const [selectedSmsIndex, setSelectedSmsIndex] = useState(0);
  
  // AI generation state
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState<string>("sequence");
  const [expandedChannel, setExpandedChannel] = useState<string | null>("email");
  const [previewCandidate, setPreviewCandidate] = useState<SelectedCandidate | null>(null);
  
  // Load data from sessionStorage
  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates") || sessionStorage.getItem("selectedCandidates");
    const storedJob = sessionStorage.getItem("campaign_job") || sessionStorage.getItem("job");
    
    if (!storedJobId || !storedCandidates) {
      toast.error("Missing campaign data");
      navigate("/campaigns/new");
      return;
    }
    
    setJobId(storedJobId);
    
    try {
      const parsedCandidates = JSON.parse(storedCandidates);
      setCandidates(parsedCandidates);
      if (parsedCandidates.length > 0) {
        setPreviewCandidate(parsedCandidates[0]);
      }
    } catch (e) {
      console.error("Error parsing candidates:", e);
    }
    
    if (storedJob) {
      try {
        setJob(JSON.parse(storedJob));
      } catch (e) {
        console.error("Error parsing job:", e);
      }
    }
    
    // Fetch job details
    const fetchJob = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", storedJobId)
        .single();
      
      if (data) {
        setJob(data);
      }
    };
    fetchJob();
  }, [navigate]);
  
  // Generate email content
  const handleGenerateEmail = async () => {
    if (!previewCandidate || !jobId) {
      toast.error("Select a candidate to preview");
      return;
    }
    
    setIsGeneratingEmail(true);
    setGenerationProgress(0);
    
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 10, 90));
    }, 300);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          candidate_id: previewCandidate.id,
          job_id: jobId,
          template_type: 'initial',
          include_full_details: true,
        },
      });
      
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      if (!error && data?.email) {
        setEmailSubject(data.email.subject);
        setEmailBody(data.email.body);
        toast.success("Email generated!");
      } else {
        // Fallback content
        const payRate = job?.pay_rate || (job?.bill_rate ? Math.round(job.bill_rate * 0.73) : 500);
        setEmailSubject(`${job?.specialty || 'Locums'} Opportunity - $${payRate}/hr - ${job?.city}, ${job?.state}`);
        setEmailBody(`Hi Dr. ${previewCandidate.last_name},

I came across your profile and wanted to reach out about a ${job?.specialty || 'locum tenens'} opportunity at ${job?.facility_name || 'our partner facility'} in ${job?.city}, ${job?.state}.

**Quick Highlights:**
• **Rate:** $${payRate}/hour (with daily OT after 9 hours)
• **Location:** ${job?.city}, ${job?.state}
• **Facility:** ${job?.facility_name}
• **Start:** Flexible

${previewCandidate.personalization_hook || 'Given your experience, I think this could be a great fit.'}

Would you be open to a quick call this week?

Best,
${emailSender.split('@')[0]}`);
        toast.success("Generated sample email");
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Email generation error:", error);
      toast.error("Failed to generate email");
    } finally {
      setIsGeneratingEmail(false);
    }
  };
  
  // Generate SMS content
  const handleGenerateSms = async () => {
    if (!previewCandidate || !jobId) {
      toast.error("Select a candidate to preview");
      return;
    }
    
    setIsGeneratingSms(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-sms', {
        body: {
          candidate_id: previewCandidate.id,
          job_id: jobId,
          template_style: smsStyle,
        },
      });
      
      if (!error && data?.sms_options) {
        setSmsMessages(data.sms_options.map((opt: any) => opt.sms));
        toast.success("SMS options generated!");
      } else {
        // Fallback content
        const payRate = job?.pay_rate || (job?.bill_rate ? Math.round(job.bill_rate * 0.73) : 500);
        setSmsMessages([
          `Dr. ${previewCandidate.last_name}, $${payRate}/hr ${job?.specialty} role in ${job?.state}. Interested? Reply YES for details.`,
          `Quick question Dr. ${previewCandidate.last_name} - open to ${job?.specialty} locums at $${payRate}/hr in ${job?.city}?`,
          `Hi Dr. ${previewCandidate.last_name}, saw your ${job?.state} license. Have a $${payRate}/hr opportunity. Worth a call?`,
        ]);
        toast.success("Generated sample SMS");
      }
    } catch (error) {
      console.error("SMS generation error:", error);
      toast.error("Failed to generate SMS");
    } finally {
      setIsGeneratingSms(false);
    }
  };
  
  // Save and proceed
  const handleNext = () => {
    if (!emailEnabled && !smsEnabled && !aiCallEnabled && !linkedinEnabled) {
      toast.error("Enable at least one channel");
      return;
    }
    
    // Build channel config
    const config = {
      email: emailEnabled ? {
        sender: emailSender,
        sequenceLength: emailSequenceCount,
        gapDays: 3,
        template: { subject: emailSubject, body: emailBody },
      } : null,
      sms: smsEnabled ? {
        fromNumber: "+12185628671",
        sequenceLength: smsSequenceCount,
        style: smsStyle,
        messages: smsMessages,
      } : null,
      aiCall: aiCallEnabled ? {
        fromNumber: "+13055634142",
        callDay: 1,
        transferTo: "rainey",
      } : null,
      linkedin: linkedinEnabled,
      schedule: {
        startDate: addDays(new Date(), 1).toISOString(),
        sendWindowStart: "9:00 AM",
        sendWindowEnd: "5:00 PM",
        timezone: "America/Chicago",
        weekdaysOnly: true,
      },
    };
    
    sessionStorage.setItem("campaign_channels", JSON.stringify(config));
    sessionStorage.setItem("channelConfig", JSON.stringify(config));
    
    navigate("/campaigns/new/review");
  };
  
  const hasContent = emailEnabled ? (emailSubject && emailBody) : true;
  const hasSmsContent = smsEnabled ? smsMessages.length > 0 : true;
  const canProceed = (emailEnabled || smsEnabled || aiCallEnabled || linkedinEnabled) && hasContent && hasSmsContent;
  const payRate = job?.pay_rate || (job?.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  
  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StepIndicator currentStep={3} steps={steps} />
          
          {/* Header Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Sequence Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your multi-channel outreach sequence with AI-personalized messages
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{candidates.length}</span>
                  <span className="text-muted-foreground">candidates</span>
                </div>
                {payRate && (
                  <Badge variant="secondary" className="text-green-500">
                    💰 ${payRate}/hr
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Channel Selection */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Channels</CardTitle>
                  <CardDescription>Select and configure your outreach channels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Email Channel */}
                  <Collapsible open={expandedChannel === "email"} onOpenChange={(open) => setExpandedChannel(open ? "email" : null)}>
                    <div className={cn(
                      "rounded-lg border p-3 transition-all",
                      emailEnabled && "ring-2 ring-primary/50 bg-primary/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <Mail className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-sm">Email</p>
                            <p className="text-xs text-muted-foreground">via Instantly</p>
                          </div>
                          {expandedChannel === "email" ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CollapsibleTrigger>
                        <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                      </div>
                      
                      <CollapsibleContent className="pt-3 space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Sender</Label>
                          <Select value={emailSender} onValueChange={setEmailSender}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {senderAccounts.map(group => (
                                <SelectGroup key={group.group}>
                                  <SelectLabel className="text-xs">{group.group}</SelectLabel>
                                  {group.emails.map(email => (
                                    <SelectItem key={email} value={email} className="text-xs">{email}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Sequence Steps</Label>
                          <Select value={emailSequenceCount.toString()} onValueChange={(v) => setEmailSequenceCount(parseInt(v))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5, 6].map(n => (
                                <SelectItem key={n} value={n.toString()} className="text-xs">{n} emails</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {emailEnabled && !emailBody && (
                          <Badge variant="outline" className="text-xs text-warning border-warning">
                            ⚠️ Generate content
                          </Badge>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                  
                  {/* SMS Channel */}
                  <Collapsible open={expandedChannel === "sms"} onOpenChange={(open) => setExpandedChannel(open ? "sms" : null)}>
                    <div className={cn(
                      "rounded-lg border p-3 transition-all",
                      smsEnabled && "ring-2 ring-green-500/50 bg-green-500/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-green-500/10">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-sm">SMS</p>
                            <p className="text-xs text-muted-foreground">via Twilio</p>
                          </div>
                          {expandedChannel === "sms" ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CollapsibleTrigger>
                        <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                      </div>
                      
                      <CollapsibleContent className="pt-3 space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Style</Label>
                          <Select value={smsStyle} onValueChange={setSmsStyle}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {smsStyles.map(style => (
                                <SelectItem key={style.value} value={style.value} className="text-xs">
                                  {style.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Sequence Steps</Label>
                          <Select value={smsSequenceCount.toString()} onValueChange={(v) => setSmsSequenceCount(parseInt(v))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map(n => (
                                <SelectItem key={n} value={n.toString()} className="text-xs">{n} texts</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {smsEnabled && smsMessages.length === 0 && (
                          <Badge variant="outline" className="text-xs text-warning border-warning">
                            ⚠️ Generate content
                          </Badge>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                  
                  {/* AI Call Channel */}
                  <div className={cn(
                    "rounded-lg border p-3 transition-all",
                    aiCallEnabled && "ring-2 ring-purple-500/50 bg-purple-500/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Phone className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">AI Calls</p>
                          <p className="text-xs text-muted-foreground">via ARIA</p>
                        </div>
                      </div>
                      <Switch checked={aiCallEnabled} onCheckedChange={setAiCallEnabled} />
                    </div>
                  </div>
                  
                  {/* LinkedIn Channel */}
                  <div className={cn(
                    "rounded-lg border p-3 transition-all",
                    linkedinEnabled && "ring-2 ring-sky-500/50 bg-sky-500/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-500/10">
                          <Linkedin className="h-4 w-4 text-sky-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">LinkedIn</p>
                          <p className="text-xs text-muted-foreground">via AIMFOX</p>
                        </div>
                      </div>
                      <Switch checked={linkedinEnabled} onCheckedChange={setLinkedinEnabled} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Candidate Preview Selector */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Preview Candidate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={previewCandidate?.id || ""} 
                    onValueChange={(id) => setPreviewCandidate(candidates.find(c => c.id === id) || null)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select candidate" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.slice(0, 10).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          Dr. {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {previewCandidate && (
                    <div className="mt-3 p-2 rounded bg-secondary/50 text-xs space-y-1">
                      <p className="font-medium">{previewCandidate.specialty}</p>
                      <p className="text-muted-foreground">{previewCandidate.personal_email || previewCandidate.email || "No email"}</p>
                      <p className="text-muted-foreground">{previewCandidate.personal_mobile || previewCandidate.phone || "No phone"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Middle + Right - Content Editor */}
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="sequence" className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Sequence Timeline
                  </TabsTrigger>
                  <TabsTrigger value="content" className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4" />
                    Message Content
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="sequence" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Outreach Sequence</CardTitle>
                      <CardDescription>Your multi-channel cadence timeline</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Day 1 */}
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                          <div className="w-16 text-center">
                            <Badge variant="outline">Day 1</Badge>
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            {emailEnabled && (
                              <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30">
                                <Mail className="h-3 w-3 mr-1" />
                                Email #1
                              </Badge>
                            )}
                            {smsEnabled && (
                              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                SMS #1
                              </Badge>
                            )}
                            {aiCallEnabled && (
                              <Badge className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/30">
                                <Phone className="h-3 w-3 mr-1" />
                                AI Call
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Day 3 */}
                        {(emailEnabled && emailSequenceCount >= 2) && (
                          <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                            <div className="w-16 text-center">
                              <Badge variant="outline">Day 3</Badge>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30">
                                <Mail className="h-3 w-3 mr-1" />
                                Follow-up #1
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {/* Day 5 */}
                        {smsEnabled && smsSequenceCount >= 2 && (
                          <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                            <div className="w-16 text-center">
                              <Badge variant="outline">Day 5</Badge>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                SMS #2
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {/* Day 6 */}
                        {emailEnabled && emailSequenceCount >= 3 && (
                          <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                            <div className="w-16 text-center">
                              <Badge variant="outline">Day 6</Badge>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30">
                                <Mail className="h-3 w-3 mr-1" />
                                Follow-up #2
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {linkedinEnabled && (
                          <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                            <div className="w-16 text-center">
                              <Badge variant="outline">Day 7</Badge>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <Badge className="bg-sky-500/20 text-sky-500 hover:bg-sky-500/30">
                                <Linkedin className="h-3 w-3 mr-1" />
                                LinkedIn Connect
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Send window: 9 AM - 5 PM CT</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Weekdays only</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="content" className="space-y-4">
                  {/* Email Content */}
                  {emailEnabled && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-500" />
                            Email Content
                          </CardTitle>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleGenerateEmail}
                            disabled={isGeneratingEmail || !previewCandidate}
                          >
                            {isGeneratingEmail ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate with AI
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {isGeneratingEmail && (
                          <Progress value={generationProgress} className="h-1" />
                        )}
                        <div className="space-y-2">
                          <Label>Subject Line</Label>
                          <Input
                            placeholder="Enter subject line..."
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email Body</Label>
                          <Textarea
                            placeholder="Compose your email (supports Markdown)..."
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            className="min-h-[250px] font-mono text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{emailBody.length} characters</span>
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(emailBody)}>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* SMS Content */}
                  {smsEnabled && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-500" />
                            SMS Content
                          </CardTitle>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleGenerateSms}
                            disabled={isGeneratingSms || !previewCandidate}
                          >
                            {isGeneratingSms ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Options
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {smsMessages.length > 0 ? (
                          <div className="space-y-3">
                            {smsMessages.map((msg, idx) => (
                              <div 
                                key={idx}
                                onClick={() => setSelectedSmsIndex(idx)}
                                className={cn(
                                  "p-3 rounded-lg border-2 cursor-pointer transition-all",
                                  selectedSmsIndex === idx 
                                    ? "border-green-500 bg-green-500/5" 
                                    : "border-border hover:border-green-500/50"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <Textarea
                                    value={msg}
                                    onChange={(e) => {
                                      const updated = [...smsMessages];
                                      updated[idx] = e.target.value;
                                      setSmsMessages(updated);
                                    }}
                                    className="min-h-[60px] text-sm border-none p-0 focus-visible:ring-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  {selectedSmsIndex === idx && (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">Option {idx + 1}</Badge>
                                  <span className={cn(
                                    "text-xs",
                                    msg.length > 160 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {msg.length}/160 chars
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Click "Generate Options" to create SMS messages</p>
                          </div>
                        )}
                        
                        <Card className="border-warning/50 bg-warning/5">
                          <CardContent className="py-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground">Twilio Best Practices</p>
                                <p>Keep under 160 chars • Space sends 30s apart • Include opt-out periodically</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
          
          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center gap-4">
              {!canProceed && (
                <p className="text-sm text-muted-foreground">
                  {!hasContent && emailEnabled && "Generate email content"}
                  {!hasSmsContent && smsEnabled && "Generate SMS content"}
                </p>
              )}
              <Button onClick={handleNext} disabled={!canProceed}>
                Next: Review & Launch
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
