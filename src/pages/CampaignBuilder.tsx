import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Mail, MessageSquare, Phone, ArrowRight, Eye, 
  Sparkles, User 
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ParsedJob } from "@/components/jobs/ParsedJobCard";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  email?: string;
  phone?: string;
}

interface ChannelConfig {
  enabled: boolean;
  template: string;
}

const defaultTemplates = {
  email: "Hi {{firstName}},\n\nI came across your profile and wanted to reach out about an exciting {{specialty}} opportunity in {{location}}.\n\nWe're offering a competitive pay rate of ${{payRate}}/hr for this locum tenens position.\n\nWould you be interested in learning more?\n\nBest regards,\nLocums One Team",
  sms: "Hi {{firstName}}! Locums One here. We have a {{specialty}} opportunity in {{location}} at ${{payRate}}/hr. Interested? Reply YES to learn more.",
  call: "Hello {{firstName}}, this is an AI assistant calling from Locums One about a {{specialty}} locum tenens opportunity in {{location}} with a pay rate of ${{payRate}} per hour. Press 1 to speak with a recruiter, or press 2 to receive more information via text.",
};

const CampaignBuilder = () => {
  const navigate = useNavigate();
  const [job, setJob] = useState<ParsedJob | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [channels, setChannels] = useState<{
    email: ChannelConfig;
    sms: ChannelConfig;
    call: ChannelConfig;
  }>({
    email: { enabled: true, template: defaultTemplates.email },
    sms: { enabled: false, template: defaultTemplates.sms },
    call: { enabled: false, template: defaultTemplates.call },
  });
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const storedJob = sessionStorage.getItem("currentJob");
    const storedCandidates = sessionStorage.getItem("selectedCandidates");
    
    if (storedJob) {
      const parsedJob = JSON.parse(storedJob);
      setJob(parsedJob);
      setCampaignName(`${parsedJob.specialty} - ${parsedJob.location}`);
    }
    
    if (storedCandidates) {
      const parsedCandidates = JSON.parse(storedCandidates);
      setCandidates(parsedCandidates);
      if (parsedCandidates.length > 0) {
        setPreviewCandidate(parsedCandidates[0]);
      }
    }
  }, []);

  const toggleChannel = (channel: "email" | "sms" | "call") => {
    setChannels(prev => ({
      ...prev,
      [channel]: { ...prev[channel], enabled: !prev[channel].enabled }
    }));
  };

  const updateTemplate = (channel: "email" | "sms" | "call", template: string) => {
    setChannels(prev => ({
      ...prev,
      [channel]: { ...prev[channel], template }
    }));
  };

  const personalizeMessage = (template: string, candidate: Candidate | null) => {
    if (!candidate || !job) return template;
    
    return template
      .replace(/\{\{firstName\}\}/g, candidate.first_name)
      .replace(/\{\{lastName\}\}/g, candidate.last_name)
      .replace(/\{\{specialty\}\}/g, job.specialty)
      .replace(/\{\{location\}\}/g, job.location)
      .replace(/\{\{payRate\}\}/g, job.payRate.toString());
  };

  const enabledChannels = Object.entries(channels)
    .filter(([_, config]) => config.enabled)
    .map(([name]) => name);

  const handleLaunch = () => {
    sessionStorage.setItem("campaignConfig", JSON.stringify({
      name: campaignName,
      channels,
      candidateCount: candidates.length,
    }));
    navigate("/launch");
  };

  return (
    <Layout currentStep={3}>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Build Your Campaign
          </h1>
          <p className="text-muted-foreground">
            {candidates.length} candidates selected • Configure your outreach channels
          </p>
        </div>

        {/* Campaign Name */}
        <div className="rounded-2xl bg-card shadow-card p-6 space-y-4">
          <Label htmlFor="campaign-name" className="text-base font-semibold">
            Campaign Name
          </Label>
          <Input
            id="campaign-name"
            placeholder="Enter campaign name..."
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="text-lg h-12"
          />
        </div>

        {/* Channel Selection */}
        <div className="grid gap-4 md:grid-cols-3">
          <ChannelCard
            icon={<Mail className="h-5 w-5" />}
            name="Email"
            description="Send personalized emails"
            enabled={channels.email.enabled}
            onToggle={() => toggleChannel("email")}
          />
          <ChannelCard
            icon={<MessageSquare className="h-5 w-5" />}
            name="SMS"
            description="Quick text messages"
            enabled={channels.sms.enabled}
            onToggle={() => toggleChannel("sms")}
            cost="$0.03/msg"
          />
          <ChannelCard
            icon={<Phone className="h-5 w-5" />}
            name="AI Call"
            description="Automated voice calls"
            enabled={channels.call.enabled}
            onToggle={() => toggleChannel("call")}
            cost="$0.15/call"
          />
        </div>

        {/* Template Editors */}
        {enabledChannels.map((channel) => (
          <div key={channel} className="rounded-2xl bg-card shadow-card p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {channel === "email" && <Mail className="h-5 w-5 text-primary" />}
                {channel === "sms" && <MessageSquare className="h-5 w-5 text-primary" />}
                {channel === "call" && <Phone className="h-5 w-5 text-primary" />}
                <h3 className="font-semibold text-foreground capitalize">
                  {channel} Template
                </h3>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Variables Available
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {["{{firstName}}", "{{lastName}}", "{{specialty}}", "{{payRate}}", "{{location}}"].map((variable) => (
                <code 
                  key={variable} 
                  className="px-2 py-1 rounded bg-secondary text-secondary-foreground cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(variable);
                  }}
                >
                  {variable}
                </code>
              ))}
            </div>

            <Textarea
              value={channels[channel as keyof typeof channels].template}
              onChange={(e) => updateTemplate(channel as any, e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />

            {/* Preview Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(prev => !prev)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Hide" : "Show"} Preview
            </Button>

            {showPreview && previewCandidate && (
              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Preview for: {previewCandidate.first_name} {previewCandidate.last_name}
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {personalizeMessage(channels[channel as keyof typeof channels].template, previewCandidate)}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Launch Button */}
        <div className="flex justify-center pt-4">
          <Button
            variant="gradient"
            size="xl"
            onClick={handleLaunch}
            disabled={enabledChannels.length === 0 || !campaignName.trim()}
            className="min-w-[240px]"
          >
            Launch Campaign
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

interface ChannelCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  cost?: string;
}

const ChannelCard = ({ icon, name, description, enabled, onToggle, cost }: ChannelCardProps) => (
  <div 
    className={cn(
      "rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer",
      enabled 
        ? "border-primary bg-primary/5 shadow-md" 
        : "border-border bg-card hover:border-primary/50"
    )}
    onClick={onToggle}
  >
    <div className="flex items-start justify-between">
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
        enabled ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
      )}>
        {icon}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
    <h3 className="mt-3 font-semibold text-foreground">{name}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
    {cost && (
      <Badge variant="secondary" className="mt-2">
        {cost}
      </Badge>
    )}
  </div>
);

export default CampaignBuilder;
