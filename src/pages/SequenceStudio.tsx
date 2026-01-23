import { useState, useEffect, useMemo } from "react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  ArrowLeft, ArrowRight, Mail, MessageSquare, Phone, Linkedin,
  Sparkles, RefreshCw, Copy, ChevronDown, ChevronUp, Plus, Trash2,
  Users, Zap, Clock, CheckCircle2, AlertTriangle, Eye, Edit3,
  Layers, Calendar, Settings, Target, GripVertical, Play
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Personalize" },
  { number: 4, label: "Sequence" },
  { number: 5, label: "Review" },
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
  id: string;
  day: number;
  channel: 'email' | 'sms' | 'call' | 'linkedin';
  type: 'initial' | 'followup' | 'reply';
  subject?: string;
  content: string;
  enabled: boolean;
}

// Default sequence steps following Salesloft best practices
const DEFAULT_SEQUENCE: SequenceStep[] = [
  {
    id: "step-1",
    day: 1,
    channel: "email",
    type: "initial",
    subject: "",
    content: "",
    enabled: true,
  },
  {
    id: "step-2",
    day: 1,
    channel: "sms",
    type: "initial",
    content: "",
    enabled: true,
  },
  {
    id: "step-3",
    day: 3,
    channel: "email",
    type: "followup",
    subject: "",
    content: "",
    enabled: true,
  },
  {
    id: "step-4",
    day: 5,
    channel: "sms",
    type: "followup",
    content: "",
    enabled: true,
  },
  {
    id: "step-5",
    day: 7,
    channel: "email",
    type: "followup",
    subject: "",
    content: "",
    enabled: true,
  },
  {
    id: "step-6",
    day: 10,
    channel: "call",
    type: "initial",
    content: "AI-powered outreach call with ARIA",
    enabled: false,
  },
];

export default function SequenceStudio() {
  const navigate = useNavigate();
  
  // Data from sessionStorage
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<SelectedCandidate[]>([]);
  
  // Sequence steps
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>(DEFAULT_SEQUENCE);
  const [activeStepId, setActiveStepId] = useState<string>("step-1");
  
  // Channel toggles
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [aiCallEnabled, setAiCallEnabled] = useState(false);
  const [linkedinEnabled, setLinkedinEnabled] = useState(false);
  
  // Email settings
  const [emailSender, setEmailSender] = useState(senderAccounts[0].emails[0]);
  
  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Preview
  const [previewCandidate, setPreviewCandidate] = useState<SelectedCandidate | null>(null);
  
  // Compute pay rate (ALWAYS use pay_rate, not bill_rate)
  const payRate = useMemo(() => {
    if (job?.pay_rate) return job.pay_rate;
    if (job?.bill_rate) return Math.round(job.bill_rate * 0.8); // 80% of bill rate as fallback
    return 500;
  }, [job]);
  
  // Load data from sessionStorage
  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates") || sessionStorage.getItem("selectedCandidates");
    const storedJob = sessionStorage.getItem("campaign_job");
    
    if (!storedJobId || !storedCandidates) {
      toast.error("Missing campaign data. Start from Candidate Matching.");
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
        sessionStorage.setItem("campaign_job", JSON.stringify(data));
      }
    };
    fetchJob();
  }, [navigate]);
  
  // Get active step
  const activeStep = useMemo(() => 
    sequenceSteps.find(s => s.id === activeStepId) || sequenceSteps[0],
    [sequenceSteps, activeStepId]
  );
  
  // Generate content for active step
  const handleGenerateContent = async () => {
    if (!previewCandidate || !jobId || !activeStep) {
      toast.error("Select a candidate to preview");
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 15, 90));
    }, 300);
    
    try {
      if (activeStep.channel === 'email') {
        const { data, error } = await supabase.functions.invoke('generate-email', {
          body: {
            candidate_id: previewCandidate.id,
            job_id: jobId,
            template_type: activeStep.type === 'initial' ? 'initial' : 'followup',
            include_full_details: activeStep.type === 'initial',
          },
        });
        
        clearInterval(progressInterval);
        setGenerationProgress(100);
        
        if (!error && data?.email) {
          updateStepContent(activeStep.id, data.email.body, data.email.subject);
          toast.success("Email generated!");
        } else {
          // Generate fallback using Dr. LastName (not FirstName)
          const subject = activeStep.type === 'initial'
            ? `${job?.specialty || 'Locums'} Opportunity - $${payRate}/hr - ${job?.city}, ${job?.state}`
            : `Re: ${job?.specialty} Opportunity - Following Up`;
          
          const body = activeStep.type === 'initial'
            ? generateInitialEmail(previewCandidate)
            : generateFollowupEmail(previewCandidate, activeStep.day);
          
          updateStepContent(activeStep.id, body, subject);
          toast.success("Generated email content");
        }
      } else if (activeStep.channel === 'sms') {
        const { data, error } = await supabase.functions.invoke('generate-sms', {
          body: {
            candidate_id: previewCandidate.id,
            job_id: jobId,
            template_style: 'punchy',
          },
        });
        
        clearInterval(progressInterval);
        setGenerationProgress(100);
        
        if (!error && data?.sms_options?.[0]) {
          updateStepContent(activeStep.id, data.sms_options[0].sms);
          toast.success("SMS generated!");
        } else {
          // Fallback SMS using Dr. LastName
          const sms = activeStep.type === 'initial'
            ? `Dr. ${previewCandidate.last_name}, $${payRate}/hr ${job?.specialty} role in ${job?.state}. Interested? Reply YES for details.`
            : `Hi Dr. ${previewCandidate.last_name}, following up on the ${job?.specialty} opportunity. Still interested? Quick call this week?`;
          
          updateStepContent(activeStep.id, sms);
          toast.success("Generated SMS content");
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Generation error:", error);
      toast.error("Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate initial email helper (using Dr. LastName)
  const generateInitialEmail = (candidate: SelectedCandidate) => {
    const hook = candidate.personalization_hook || candidate.icebreaker || "";
    return `Hi Dr. ${candidate.last_name},

${hook || `I came across your profile and wanted to reach out about a ${job?.specialty || 'locum tenens'} opportunity.`}

**Quick Highlights:**
• **Rate:** $${payRate}/hour (with daily OT after 9 hours)
• **Location:** ${job?.city}, ${job?.state}
• **Facility:** ${job?.facility_name}
• **Start:** Flexible

Would you be open to a quick call this week?

Best,
${emailSender.split('@')[0]}`;
  };
  
  // Generate followup email helper
  const generateFollowupEmail = (candidate: SelectedCandidate, day: number) => {
    if (day <= 4) {
      return `Hi Dr. ${candidate.last_name},

Just following up on my previous note about the ${job?.specialty} opportunity in ${job?.city}, ${job?.state}.

The $${payRate}/hr rate is still available, and we're getting strong interest. Would love to connect if timing works.

Let me know if you have 10 minutes this week?

Best,
${emailSender.split('@')[0]}`;
    } else {
      return `Dr. ${candidate.last_name},

Quick check-in on the ${job?.specialty} role at ${job?.facility_name}. 

Still open at $${payRate}/hr if your situation has changed. Happy to share more details whenever convenient.

Best,
${emailSender.split('@')[0]}`;
    }
  };
  
  // Update step content
  const updateStepContent = (stepId: string, content: string, subject?: string) => {
    setSequenceSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, content, ...(subject ? { subject } : {}) }
        : step
    ));
  };
  
  // Update step day
  const updateStepDay = (stepId: string, day: number) => {
    setSequenceSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, day } : step
    ));
  };
  
  // Toggle step enabled
  const toggleStepEnabled = (stepId: string) => {
    setSequenceSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, enabled: !step.enabled } : step
    ));
  };
  
  // Add new step
  const addStep = (channel: 'email' | 'sms') => {
    const lastStep = sequenceSteps[sequenceSteps.length - 1];
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      day: (lastStep?.day || 0) + 3,
      channel,
      type: 'followup',
      content: "",
      subject: channel === 'email' ? "" : undefined,
      enabled: true,
    };
    setSequenceSteps(prev => [...prev, newStep]);
    setActiveStepId(newStep.id);
    toast.success(`Added ${channel.toUpperCase()} step`);
  };
  
  // Remove step
  const removeStep = (stepId: string) => {
    setSequenceSteps(prev => prev.filter(s => s.id !== stepId));
    if (activeStepId === stepId) {
      setActiveStepId(sequenceSteps[0]?.id || "");
    }
    toast.success("Step removed");
  };
  
  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'sms': return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'call': return <Phone className="h-4 w-4 text-purple-500" />;
      case 'linkedin': return <Linkedin className="h-4 w-4 text-sky-500" />;
      default: return null;
    }
  };
  
  // Get channel color
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email': return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case 'sms': return "bg-green-500/10 text-green-600 border-green-500/30";
      case 'call': return "bg-purple-500/10 text-purple-600 border-purple-500/30";
      case 'linkedin': return "bg-sky-500/10 text-sky-600 border-sky-500/30";
      default: return "";
    }
  };
  
  // Save and proceed
  const handleNext = () => {
    const enabledSteps = sequenceSteps.filter(s => s.enabled);
    if (enabledSteps.length === 0) {
      toast.error("Enable at least one sequence step");
      return;
    }
    
    const hasContent = enabledSteps.every(s => s.content.trim());
    if (!hasContent) {
      toast.error("All enabled steps need content. Generate or write content for each step.");
      return;
    }
    
    // Build channel config
    const config = {
      email: emailEnabled ? {
        sender: emailSender,
        steps: sequenceSteps.filter(s => s.channel === 'email' && s.enabled),
      } : null,
      sms: smsEnabled ? {
        fromNumber: "+12185628671",
        steps: sequenceSteps.filter(s => s.channel === 'sms' && s.enabled),
      } : null,
      aiCall: aiCallEnabled ? {
        fromNumber: "+13055634142",
        steps: sequenceSteps.filter(s => s.channel === 'call' && s.enabled),
      } : null,
      linkedin: linkedinEnabled,
      schedule: {
        startDate: addDays(new Date(), 1).toISOString(),
        sendWindowStart: "9:00 AM",
        sendWindowEnd: "5:00 PM",
        timezone: "America/Chicago",
        weekdaysOnly: true,
      },
      sequenceSteps: sequenceSteps,
    };
    
    sessionStorage.setItem("campaign_channels", JSON.stringify(config));
    navigate("/campaigns/new/review");
  };
  
  const enabledSteps = sequenceSteps.filter(s => s.enabled);
  const stepsWithContent = enabledSteps.filter(s => s.content.trim());
  const canProceed = enabledSteps.length > 0 && stepsWithContent.length === enabledSteps.length;
  
  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StepIndicator currentStep={4} steps={steps} />
          
          {/* Header Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Sequence Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Build your multi-channel outreach cadence with editable touchpoints
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{candidates.length}</span>
                  <span className="text-muted-foreground">candidates</span>
                </div>
                <Badge variant="secondary" className="text-green-600">
                  💰 ${payRate}/hr pay
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Vertical Stepper (Salesloft-style) */}
            <div className="lg:col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Sequence Steps</CardTitle>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => addStep('email')}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => addStep('sms')}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Click to edit each touchpoint
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-3 space-y-1">
                      {sequenceSteps.map((step, idx) => (
                        <div
                          key={step.id}
                          onClick={() => setActiveStepId(step.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                            activeStepId === step.id 
                              ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30" 
                              : "hover:bg-secondary/50 border-transparent",
                            !step.enabled && "opacity-50"
                          )}
                        >
                          {/* Connector Line */}
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                              getChannelColor(step.channel)
                            )}>
                              {step.day}
                            </div>
                            {idx < sequenceSteps.length - 1 && (
                              <div className="w-px h-4 bg-border mt-1" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getChannelIcon(step.channel)}
                              <span className="text-sm font-medium capitalize">
                                {step.channel} {step.type === 'followup' ? '(Follow-up)' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {step.content ? step.content.substring(0, 40) + "..." : "No content yet"}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {step.content ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <Switch
                              checked={step.enabled}
                              onCheckedChange={() => toggleStepEnabled(step.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="scale-75"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              {/* Channel Toggles */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Enabled Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Email (Instantly)
                    </Label>
                    <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      SMS (Twilio)
                    </Label>
                    <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-purple-500" />
                      AI Calls (ARIA)
                    </Label>
                    <Switch checked={aiCallEnabled} onCheckedChange={setAiCallEnabled} />
                  </div>
                </CardContent>
              </Card>
              
              {/* Preview Candidate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Preview For
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
                      {candidates.slice(0, 15).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          Dr. {c.last_name} - {c.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Panel - Step Editor */}
            <div className="lg:col-span-8">
              {activeStep && (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          activeStep.channel === 'email' && "bg-blue-500/10",
                          activeStep.channel === 'sms' && "bg-green-500/10",
                          activeStep.channel === 'call' && "bg-purple-500/10"
                        )}>
                          {getChannelIcon(activeStep.channel)}
                        </div>
                        <div>
                          <CardTitle className="text-lg capitalize">
                            Day {activeStep.day} - {activeStep.channel} 
                            {activeStep.type === 'followup' && ' (Follow-up)'}
                          </CardTitle>
                          <CardDescription>
                            {activeStep.channel === 'email' && "Edit subject and body below"}
                            {activeStep.channel === 'sms' && "Keep under 160 characters"}
                            {activeStep.channel === 'call' && "Configure AI call script"}
                          </CardDescription>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleGenerateContent}
                          disabled={isGenerating || !previewCandidate}
                        >
                          {isGenerating ? (
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
                        {sequenceSteps.length > 1 && activeStep.type === 'followup' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeStep(activeStep.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isGenerating && (
                      <Progress value={generationProgress} className="h-1" />
                    )}
                    
                    {/* Day Selector */}
                    <div className="flex items-center gap-4">
                      <Label className="w-20">Send Day</Label>
                      <Select 
                        value={activeStep.day.toString()} 
                        onValueChange={(v) => updateStepDay(activeStep.id, parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 17, 21].map(d => (
                            <SelectItem key={d} value={d.toString()}>Day {d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Email-specific: Subject Line */}
                    {activeStep.channel === 'email' && (
                      <div className="space-y-2">
                        <Label>Subject Line</Label>
                        <Input
                          placeholder={`${job?.specialty} Opportunity - $${payRate}/hr - ${job?.city}, ${job?.state}`}
                          value={activeStep.subject || ""}
                          onChange={(e) => setSequenceSteps(prev => prev.map(s => 
                            s.id === activeStep.id ? { ...s, subject: e.target.value } : s
                          ))}
                        />
                      </div>
                    )}
                    
                    {/* Email Sender (for email steps) */}
                    {activeStep.channel === 'email' && (
                      <div className="space-y-2">
                        <Label>Send From</Label>
                        <Select value={emailSender} onValueChange={setEmailSender}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {senderAccounts.map(group => (
                              <SelectGroup key={group.group}>
                                <SelectLabel>{group.group}</SelectLabel>
                                {group.emails.map(email => (
                                  <SelectItem key={email} value={email}>{email}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Content Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{activeStep.channel === 'email' ? 'Email Body' : 'Message'}</Label>
                        {activeStep.channel === 'sms' && activeStep.content && (
                          <span className={cn(
                            "text-xs",
                            activeStep.content.length > 160 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {activeStep.content.length}/160
                          </span>
                        )}
                      </div>
                      <Textarea
                        placeholder={
                          activeStep.channel === 'email' 
                            ? "Write your email content here. Use {{first_name}}, {{last_name}}, {{specialty}} as merge tags..."
                            : "Keep your SMS short and punchy. Max 160 characters recommended."
                        }
                        value={activeStep.content}
                        onChange={(e) => updateStepContent(activeStep.id, e.target.value)}
                        className={cn(
                          "font-mono text-sm",
                          activeStep.channel === 'email' ? "min-h-[300px]" : "min-h-[100px]"
                        )}
                      />
                    </div>
                    
                    {/* Preview */}
                    {previewCandidate && activeStep.content && (
                      <div className="mt-4 p-4 rounded-lg bg-secondary/30 border">
                        <Label className="text-xs text-muted-foreground mb-2 block">
                          Preview for Dr. {previewCandidate.last_name}
                        </Label>
                        <div className="text-sm whitespace-pre-wrap">
                          {activeStep.content
                            .replace(/\{\{first_name\}\}/g, previewCandidate.first_name || "")
                            .replace(/\{\{last_name\}\}/g, previewCandidate.last_name || "")
                            .replace(/\{\{specialty\}\}/g, previewCandidate.specialty || "")
                          }
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => navigate("/campaigns/new/personalize")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Personalization
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {stepsWithContent.length}/{enabledSteps.length} steps ready
              </div>
              <Button onClick={handleNext} disabled={!canProceed}>
                Continue to Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
