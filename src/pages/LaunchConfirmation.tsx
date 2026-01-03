import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Rocket, CheckCircle2, Mail, MessageSquare, Phone,
  Users, DollarSign, ArrowLeft, Loader2, PartyPopper
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignConfig {
  name: string;
  channels: {
    email: { enabled: boolean };
    sms: { enabled: boolean };
    call: { enabled: boolean };
  };
  candidateCount: number;
}

const LaunchConfirmation = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);
  const [campaignId, setCampaignId] = useState("");

  useEffect(() => {
    const storedConfig = sessionStorage.getItem("campaignConfig");
    if (storedConfig) {
      setConfig(JSON.parse(storedConfig));
    }
  }, []);

  if (!config) {
    return (
      <Layout currentStep={4}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No campaign configuration found.</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
            Start Over
          </Button>
        </div>
      </Layout>
    );
  }

  const enabledChannels = Object.entries(config.channels)
    .filter(([_, value]) => value.enabled)
    .map(([key]) => key);

  // Calculate costs
  const smsCost = config.channels.sms.enabled ? config.candidateCount * 0.03 : 0;
  const callCost = config.channels.call.enabled ? config.candidateCount * 0.15 : 0;
  const totalCost = smsCost + callCost;

  const handleLaunch = async () => {
    setIsLaunching(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2500));
    
    const newCampaignId = `CAM-${Date.now().toString(36).toUpperCase()}`;
    setCampaignId(newCampaignId);
    setIsLaunching(false);
    setIsLaunched(true);

    // Clear session storage
    sessionStorage.removeItem("currentJob");
    sessionStorage.removeItem("selectedCandidates");
    sessionStorage.removeItem("campaignConfig");
  };

  if (isLaunched) {
    return (
      <Layout currentStep={4}>
        <div className="mx-auto max-w-lg text-center space-y-8 py-12">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-glow" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full gradient-primary">
              <PartyPopper className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Campaign Launched! 🎉
            </h1>
            <p className="text-muted-foreground">
              Your outreach campaign is now live and running
            </p>
          </div>

          <div className="rounded-2xl bg-card shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Campaign ID</span>
              <code className="px-3 py-1 rounded-lg bg-secondary font-mono text-sm font-semibold text-foreground">
                {campaignId}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="flex items-center gap-2 text-success font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Recipients</span>
              <span className="font-medium text-foreground">{config.candidateCount}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Create Another Campaign
            </Button>
            <Button variant="gradient" onClick={() => navigate("/campaigns")}>
              View All Campaigns
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentStep={4}>
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Review & Launch
          </h1>
          <p className="text-muted-foreground">
            Confirm your campaign details before launching
          </p>
        </div>

        {/* Campaign Summary */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden">
          <div className="gradient-primary px-6 py-4">
            <h2 className="font-display text-xl font-bold text-primary-foreground">
              {config.name}
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Recipients */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Recipients</p>
                <p className="text-2xl font-bold text-foreground">{config.candidateCount}</p>
              </div>
            </div>

            {/* Channels */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Channels
              </h3>
              <div className="flex flex-wrap gap-3">
                {config.channels.email.enabled && (
                  <ChannelBadge icon={<Mail className="h-4 w-4" />} name="Email" />
                )}
                {config.channels.sms.enabled && (
                  <ChannelBadge icon={<MessageSquare className="h-4 w-4" />} name="SMS" />
                )}
                {config.channels.call.enabled && (
                  <ChannelBadge icon={<Phone className="h-4 w-4" />} name="AI Call" />
                )}
              </div>
            </div>

            {/* Cost Breakdown */}
            {totalCost > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Cost Estimate
                </h3>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  {smsCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        SMS ({config.candidateCount} × $0.03)
                      </span>
                      <span className="font-medium text-foreground">
                        ${smsCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {callCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        AI Calls ({config.candidateCount} × $0.15)
                      </span>
                      <span className="font-medium text-foreground">
                        ${callCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-border flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-foreground">${totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/campaign-builder")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Edit Campaign
          </Button>
          <Button
            variant="gradient"
            size="lg"
            className="flex-1"
            onClick={handleLaunch}
            disabled={isLaunching}
          >
            {isLaunching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5" />
                Launch Campaign
              </>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

interface ChannelBadgeProps {
  icon: React.ReactNode;
  name: string;
}

const ChannelBadge = ({ icon, name }: ChannelBadgeProps) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
    {icon}
    <span className="font-medium text-sm">{name}</span>
  </div>
);

export default LaunchConfirmation;
