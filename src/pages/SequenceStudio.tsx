import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays } from "date-fns";
import {
  ArrowLeft, ArrowRight, Mail, MessageSquare, Phone,
  Sparkles, RefreshCw, Plus, Trash2,
  Users, Clock, CheckCircle2, AlertTriangle,
  Layers, Target, Zap, Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SequenceTimeline } from "@/components/sequence/SequenceTimeline";
import { QAPanel } from "@/components/sequence/QAPanel";

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
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  approved?: boolean;
}

interface SequenceStep {
  id: string;
  day: number;
  channel: 'email' | 'sms' | 'call' | 'linkedin';
  type: 'initial' | 'followup' | 'reply';
  subject?: string;
  content: string;
  enabled: boolean;
  fromPersonalization?: boolean;
}

// Default sequence steps - SMS only on Day 1 to prevent spam
const DEFAULT_SEQUENCE: SequenceStep[] = [
  {
    id: "step-1",
    day: 1,
    channel: "email",
    type: "initial",
    subject: "",
    content: "",
    enabled: true,
    fromPersonalization: false,
  },
  {
    id: "step-2",
    day: 1,
    channel: "sms",
    type: "initial",
    content: "",
    enabled: true,
    fromPersonalization: false,
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
  // Day 5 email instead of SMS to prevent spam
  {
    id: "step-4",
    day: 5,
    channel: "email",
    type: "followup",
    subject: "",
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
  
  // Email settings
  const [emailSender, setEmailSender] = useState(senderAccounts[0].emails[0]);
  
  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatingStepIds, setGeneratingStepIds] = useState<string[]>([]);
  
  // Active view tab
  const [activeTab, setActiveTab] = useState<string>("editor");
  
  // Preview
  const [previewCandidate, setPreviewCandidate] = useState<SelectedCandidate | null>(null);
  
  // Track if auto-generation has run
  const autoGeneratedRef = useRef(false);
  
  // Compute pay rate (ALWAYS use pay_rate, not bill_rate)
  const payRate = useMemo(() => {
    if (job?.pay_rate) return job.pay_rate;
    if (job?.bill_rate) return Math.round(job.bill_rate * 0.8);
    return 500;
  }, [job]);
  
  // Load data from sessionStorage and PRE-POPULATE from Step 3
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
      // Add approved field if not present
      const candidatesWithApproval = parsedCandidates.map((c: SelectedCandidate) => ({
        ...c,
        approved: c.approved ?? false,
      }));
      setCandidates(candidatesWithApproval);
      
      if (parsedCandidates.length > 0) {
        setPreviewCandidate(parsedCandidates[0]);
        
        // *** CRITICAL: Pre-populate from Personalization Studio ***
        const firstCandidate = parsedCandidates[0];
        if (firstCandidate.email_body || firstCandidate.sms_message) {
          setSequenceSteps(prev => prev.map(step => {
            if (step.id === 'step-1' && step.channel === 'email' && firstCandidate.email_body) {
              return { 
                ...step, 
                subject: firstCandidate.email_subject || '', 
                content: firstCandidate.email_body || '',
                fromPersonalization: true,
              };
            }
            if (step.id === 'step-2' && step.channel === 'sms' && firstCandidate.sms_message) {
              return { 
                ...step, 
                content: firstCandidate.sms_message || '',
                fromPersonalization: true,
              };
            }
            return step;
          }));
          
          toast.success("Loaded personalized content from Step 3");
        }
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
  
  // *** FIX: Update sequence steps when preview candidate changes ***
  useEffect(() => {
    if (!previewCandidate) return;
    
    // Update Day 1 steps with selected candidate's personalized content
    setSequenceSteps(prev => prev.map(step => {
      if (step.id === 'step-1' && step.channel === 'email') {
        return { 
          ...step, 
          subject: previewCandidate.email_subject || step.subject, 
          content: previewCandidate.email_body || step.content,
          fromPersonalization: !!(previewCandidate.email_body),
        };
      }
      if (step.id === 'step-2' && step.channel === 'sms') {
        return { 
          ...step, 
          content: previewCandidate.sms_message || step.content,
          fromPersonalization: !!(previewCandidate.sms_message),
        };
      }
      return step;
    }));
  }, [previewCandidate?.id]);
  
  // Check if initial steps have content (from Step 3)
  const hasInitialContent = useMemo(() => {
    const step1 = sequenceSteps.find(s => s.id === 'step-1');
    const step2 = sequenceSteps.find(s => s.id === 'step-2');
    return !!(step1?.content?.trim() && step2?.content?.trim());
  }, [sequenceSteps]);
  
  // Check if follow-ups are empty
  const followupsEmpty = useMemo(() => {
    return sequenceSteps
      .filter(s => s.type === 'followup' && s.channel !== 'call')
      .every(s => !s.content?.trim());
  }, [sequenceSteps]);
  
  // *** AUTO-GENERATE follow-ups on page load ***
  useEffect(() => {
    if (
      hasInitialContent && 
      followupsEmpty && 
      !isGenerating && 
      previewCandidate && 
      job && 
      jobId &&
      !autoGeneratedRef.current
    ) {
      autoGeneratedRef.current = true;
      
      // Delay to allow UI to settle
      const timer = setTimeout(() => {
        toast.info("Auto-generating follow-up messages...");
        handleGenerateFullSequence();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [hasInitialContent, followupsEmpty, isGenerating, previewCandidate?.id, job?.id, jobId]);
  
  // Get active step
  const activeStep = useMemo(() => 
    sequenceSteps.find(s => s.id === activeStepId) || sequenceSteps[0],
    [sequenceSteps, activeStepId]
  );
  
  // Generate FULL sequence with one click
  const handleGenerateFullSequence = async () => {
    if (!previewCandidate || !jobId || !job) {
      toast.error("Missing data. Please ensure job and candidates are loaded.");
      return;
    }
    
    const step1 = sequenceSteps.find(s => s.id === 'step-1');
    const step2 = sequenceSteps.find(s => s.id === 'step-2');
    
    if (!step1?.content || !step2?.content) {
      toast.error("Day 1 Email and SMS must have content first.");
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Mark follow-up steps as generating
    const followupStepIds = sequenceSteps
      .filter(s => s.type === 'followup' && s.channel !== 'call')
      .map(s => s.id);
    setGeneratingStepIds(followupStepIds);
    
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 10, 90));
    }, 400);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-sequence', {
        body: {
          job_id: jobId,
          initial_email_subject: step1.subject || '',
          initial_email_body: step1.content,
          initial_sms: step2.content,
          candidate: {
            id: previewCandidate.id,
            first_name: previewCandidate.first_name,
            last_name: previewCandidate.last_name,
            specialty: previewCandidate.specialty,
          },
          job: {
            specialty: job.specialty,
            facility_name: job.facility_name,
            city: job.city,
            state: job.state,
            pay_rate: payRate,
          },
        },
      });
      
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      if (!error && data?.sequence_steps) {
        // Map generated steps to our sequence
        const generatedSteps = data.sequence_steps;
        
        setSequenceSteps(prev => prev.map(step => {
          if (step.type !== 'followup') return step;
          
          const generated = generatedSteps.find((g: { day: number; channel: string }) => 
            g.day === step.day && g.channel === step.channel
          );
          
          if (generated) {
            return {
              ...step,
              subject: generated.subject || step.subject,
              content: generated.content || step.content,
            };
          }
          return step;
        }));
        
        toast.success("Follow-up sequence generated!");
      } else {
        // Use fallback generation
        generateFallbackSequence();
        toast.success("Generated sequence using templates");
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Generation error:", error);
      generateFallbackSequence();
      toast.success("Generated sequence using templates");
    } finally {
      setIsGenerating(false);
      setGeneratingStepIds([]);
    }
  };
  
  // Fallback sequence generation
  const generateFallbackSequence = () => {
    setSequenceSteps(prev => prev.map(step => {
      if (step.type !== 'followup' || step.channel === 'call') return step;
      
      const lastName = previewCandidate?.last_name || 'Doctor';
      
      if (step.day === 3 && step.channel === 'email') {
        return {
          ...step,
          subject: `Following up - ${job?.specialty} in ${job?.state || 'your area'}`,
          content: `Dr. ${lastName},

Just following up on my previous note about the ${job?.specialty} opportunity at ${job?.facility_name || 'the facility'}.

The $${payRate}/hr rate is still available. Would 10 minutes work this week to discuss?

Best,`,
        };
      }
      
      if (step.day === 5 && step.channel === 'email') {
        return {
          ...step,
          subject: `Quick check - ${job?.specialty} at $${payRate}/hr`,
          content: `Dr. ${lastName},

Wanted to circle back on the ${job?.specialty} opportunity in ${job?.city}, ${job?.state}.

Happy to share more details whenever convenient. Let me know if timing works better next week.

Best,`,
        };
      }
      
      if (step.day === 7 && step.channel === 'email') {
        return {
          ...step,
          subject: `Final check-in - ${job?.specialty} opportunity`,
          content: `Dr. ${lastName},

Last note on the ${job?.specialty} position in ${job?.city}, ${job?.state}. The $${payRate}/hr opportunity is still open if your situation has changed.

Happy to share details whenever convenient.

Best,`,
        };
      }
      
      return step;
    }));
  };
  
  // Generate content for single step
  const handleGenerateSingleStep = async () => {
    if (!previewCandidate || !jobId || !activeStep) {
      toast.error("Select a candidate to preview");
      return;
    }
    
    setIsGenerating(true);
    setGeneratingStepIds([activeStep.id]);
    setGenerationProgress(0);
    
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 15, 90));
    }, 300);
    
    try {
      if (activeStep.channel === 'email') {
        // Get playbook data from sessionStorage (set in Personalization Studio)
        const storedPlaybook = sessionStorage.getItem("campaign_playbook_data");
        const campaignId = sessionStorage.getItem("campaign_id");
        let playbookData = null;
        
        if (storedPlaybook) {
          try {
            playbookData = JSON.parse(storedPlaybook);
          } catch (e) {
            console.error("Failed to parse stored playbook:", e);
          }
        }
        
        const { data, error } = await supabase.functions.invoke('generate-email', {
          body: {
            candidate_id: previewCandidate.id,
            job_id: jobId,
            campaign_id: campaignId || undefined,
            playbook_data: playbookData || undefined,
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
          // Fallback
          const subject = activeStep.type === 'initial'
            ? `${job?.specialty || 'Locums'} Opportunity - $${payRate}/hr - ${job?.city}, ${job?.state}`
            : `Re: ${job?.specialty} Opportunity`;
          
          const body = activeStep.type === 'initial'
            ? generateInitialEmail(previewCandidate)
            : generateFollowupEmail(previewCandidate, activeStep.day);
          
          updateStepContent(activeStep.id, body, subject);
          toast.success("Generated email content");
        }
      } else if (activeStep.channel === 'sms') {
        // Get playbook data from sessionStorage
        const storedPlaybook = sessionStorage.getItem("campaign_playbook_data");
        const campaignId = sessionStorage.getItem("campaign_id");
        let playbookData = null;
        
        if (storedPlaybook) {
          try {
            playbookData = JSON.parse(storedPlaybook);
          } catch (e) {
            console.error("Failed to parse stored playbook:", e);
          }
        }
        
        const { data, error } = await supabase.functions.invoke('generate-sms', {
          body: {
            candidate_id: previewCandidate.id,
            job_id: jobId,
            campaign_id: campaignId || undefined,
            playbook_data: playbookData || undefined,
            template_style: 'punchy',
          },
        });
        
        clearInterval(progressInterval);
        setGenerationProgress(100);
        
        if (!error && data?.sms_options?.[0]) {
          updateStepContent(activeStep.id, data.sms_options[0].sms);
          toast.success("SMS generated!");
        } else {
          const sms = activeStep.type === 'initial'
            ? `Dr. ${previewCandidate.last_name}, $${payRate}/hr ${job?.specialty} role in ${job?.state}. Interested? Reply YES for details.`
            : `Hi Dr. ${previewCandidate.last_name}, following up on the ${job?.specialty} opportunity. Still interested?`;
          
          updateStepContent(activeStep.id, sms.substring(0, 160));
          toast.success("Generated SMS content");
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Generation error:", error);
      toast.error("Failed to generate content");
    } finally {
      setIsGenerating(false);
      setGeneratingStepIds([]);
    }
  };
  
  // Generate initial email helper
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

The $${payRate}/hr rate is still available. Would love to connect if timing works.

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
  
  // QA Panel handlers
  const handleApproveCandidate = (candidateId: string) => {
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, approved: !c.approved } : c
    ));
  };
  
  const handleApproveAll = () => {
    setCandidates(prev => prev.map(c => ({ ...c, approved: true })));
    toast.success("All candidates approved");
  };
  
  const handleUpdateMessage = (
    candidateId: string, 
    field: 'email_subject' | 'email_body' | 'sms_message', 
    value: string
  ) => {
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, [field]: value } : c
    ));
  };
  
  // *** NEW: Quick Launch - Send Day 1 Only ***
  const handleQuickLaunch = () => {
    const step1 = sequenceSteps.find(s => s.id === 'step-1');
    const step2 = sequenceSteps.find(s => s.id === 'step-2');
    
    if (!step1?.content?.trim() && !step2?.content?.trim()) {
      toast.error("Day 1 Email or SMS must have content");
      return;
    }
    
    // Build minimal channel config with only Day 1 steps
    const config = {
      email: emailEnabled && step1?.content ? {
        sender: emailSender,
        steps: [step1],
      } : null,
      sms: smsEnabled && step2?.content ? {
        fromNumber: "+12185628671",
        steps: [step2],
      } : null,
      aiCall: null,
      linkedin: false,
      schedule: {
        startDate: addDays(new Date(), 1).toISOString(),
        sendWindowStart: "9:00 AM",
        sendWindowEnd: "5:00 PM",
        timezone: "America/Chicago",
        weekdaysOnly: true,
      },
      sequenceSteps: [step1, step2].filter(Boolean),
    };
    
    sessionStorage.setItem("campaign_candidates", JSON.stringify(candidates));
    sessionStorage.setItem("campaign_channels", JSON.stringify(config));
    toast.success("Skipping to review with Day 1 messages only");
    navigate("/campaigns/new/review");
  };
  
  // Save and proceed
  const handleNext = () => {
    const enabledSteps = sequenceSteps.filter(s => s.enabled && s.channel !== 'call');
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
      linkedin: false,
      schedule: {
        startDate: addDays(new Date(), 1).toISOString(),
        sendWindowStart: "9:00 AM",
        sendWindowEnd: "5:00 PM",
        timezone: "America/Chicago",
        weekdaysOnly: true,
      },
      sequenceSteps: sequenceSteps,
    };
    
    // Save updated candidates with any QA edits
    sessionStorage.setItem("campaign_candidates", JSON.stringify(candidates));
    sessionStorage.setItem("campaign_channels", JSON.stringify(config));
    navigate("/campaigns/new/review");
  };
  
  const enabledSteps = sequenceSteps.filter(s => s.enabled && s.channel !== 'call');
  const stepsWithContent = enabledSteps.filter(s => s.content.trim());
  const canProceed = enabledSteps.length > 0 && stepsWithContent.length === enabledSteps.length;
  
  // Check for SMS follow-ups (spam warning)
  const hasSmsFollowups = sequenceSteps.filter(s => 
    s.channel === 'sms' && s.type === 'followup' && s.enabled
  ).length > 0;
  
  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StepIndicator currentStep={4} steps={steps} />
          
          {/* Header with Generate Button */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Sequence Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Build your multi-channel outreach cadence
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{candidates.length}</span>
                    <span className="text-muted-foreground">candidates</span>
                  </div>
                  <Badge variant="secondary" className="text-green-600 bg-green-500/10 border-green-500/30">
                    ${payRate}/hr pay
                  </Badge>
                </div>
                
                {/* Quick Launch - Day 1 Only */}
                <Button 
                  variant="outline"
                  onClick={handleQuickLaunch}
                  disabled={!hasInitialContent}
                  className="border-primary/30"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Day 1 Only
                </Button>
                
                {/* One-Click Generate Button */}
                <Button 
                  onClick={handleGenerateFullSequence}
                  disabled={isGenerating || !hasInitialContent}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Full Sequence
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Progress bar during generation */}
            {isGenerating && (
              <div className="mt-4">
                <Progress value={generationProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Generating follow-up messages for Days 3, 5, and 7...
                </p>
              </div>
            )}
          </div>
          
          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="editor" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Sequence Editor
              </TabsTrigger>
              <TabsTrigger value="qa" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                QA Review
                {candidates.filter(c => c.approved).length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {candidates.filter(c => c.approved).length}/{candidates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            {/* Editor Tab */}
            <TabsContent value="editor" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel - Visual Timeline */}
                <div className="lg:col-span-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Sequence Timeline</CardTitle>
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
                        Click a step to edit • Green = ready
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <SequenceTimeline
                        steps={sequenceSteps}
                        activeStepId={activeStepId}
                        onSelectStep={setActiveStepId}
                        onToggleStep={toggleStepEnabled}
                        generatingStepIds={generatingStepIds}
                      />
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
                      {/* SMS Spam Warning */}
                      {hasSmsFollowups && (
                        <div className="flex items-center gap-2 text-amber-500 text-xs p-2 bg-amber-500/10 rounded-md">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span>SMS follow-ups may trigger spam filters</span>
                        </div>
                      )}
                      {/* ARIA AI Calls - Greyed Out */}
                      <div className="flex items-center justify-between opacity-50">
                        <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4 text-purple-500" />
                          AI Calls (ARIA)
                          <Badge variant="outline" className="text-[10px] ml-1">
                            Coming Soon
                          </Badge>
                        </Label>
                        <Switch checked={false} disabled />
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
                        onValueChange={(id) => {
                          const candidate = candidates.find(c => c.id === id);
                          if (candidate) {
                            setPreviewCandidate(candidate);
                          }
                        }}
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
                  {activeStep && activeStep.channel !== 'call' && (
                    <Card className="h-full">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              activeStep.channel === 'email' && "bg-blue-500/10",
                              activeStep.channel === 'sms' && "bg-green-500/10"
                            )}>
                              {activeStep.channel === 'email' ? (
                                <Mail className="h-5 w-5 text-blue-500" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-green-500" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg capitalize flex items-center gap-2">
                                Day {activeStep.day} - {activeStep.channel}
                                {activeStep.type === 'followup' && ' (Follow-up)'}
                                {activeStep.fromPersonalization && (
                                  <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                    From Personalization
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription>
                                {activeStep.channel === 'email' && "Edit subject and body below"}
                                {activeStep.channel === 'sms' && "Keep under 160 characters"}
                              </CardDescription>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleGenerateSingleStep}
                              disabled={isGenerating || !previewCandidate}
                            >
                              {generatingStepIds.includes(activeStep.id) ? (
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
                        
                        {/* Email Subject */}
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
                        
                        {/* Email Sender */}
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
                                ? "Write your email content here..."
                                : "Keep your SMS short and punchy. Max 160 characters."
                            }
                            value={activeStep.content}
                            onChange={(e) => updateStepContent(activeStep.id, e.target.value)}
                            className={cn(
                              "font-mono text-sm",
                              activeStep.channel === 'email' ? "min-h-[280px]" : "min-h-[100px]"
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
                  
                  {/* ARIA Call Step - Coming Soon */}
                  {activeStep && activeStep.channel === 'call' && (
                    <Card className="h-full flex items-center justify-center">
                      <CardContent className="text-center py-16">
                        <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                          <Phone className="h-8 w-8 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">ARIA AI Calls</h3>
                        <p className="text-muted-foreground mb-4">
                          AI-powered voice outreach is coming soon.
                        </p>
                        <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                          Expected Q2 2025
                        </Badge>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* QA Review Tab */}
            <TabsContent value="qa" className="mt-0">
              <QAPanel
                candidates={candidates}
                onApprove={handleApproveCandidate}
                onApproveAll={handleApproveAll}
                onUpdateMessage={handleUpdateMessage}
              />
            </TabsContent>
          </Tabs>
          
          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => navigate("/campaigns/new/personalize")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Personalization
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {stepsWithContent.length < enabledSteps.length && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <span>
                  {stepsWithContent.length}/{enabledSteps.length} steps ready
                </span>
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
