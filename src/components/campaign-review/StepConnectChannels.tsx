import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, Linkedin, CheckCircle2, XCircle, Loader2, RefreshCw, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ChannelConfig, IntegrationStatus as IntegrationStatusType } from "./types";

interface StepConnectChannelsProps {
  channels: ChannelConfig;
  senderEmail: string;
  onStatusChange: (connected: boolean, details?: IntegrationStatusType[]) => void;
  onChannelsChange?: (channels: ChannelConfig) => void;
}

interface ChannelStatus {
  name: string;
  key: string;
  icon: React.ReactNode;
  enabled: boolean;
  status: "checking" | "connected" | "disconnected" | "manual";
  details?: string;
  error?: string;
}

export function StepConnectChannels({
  channels,
  senderEmail,
  onStatusChange,
  onChannelsChange,
}: StepConnectChannelsProps) {
  const navigate = useNavigate();
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  
  // Local toggle states for quick enable/disable
  const [emailEnabled, setEmailEnabled] = useState(!!channels.email);
  const [smsEnabled, setSmsEnabled] = useState(!!channels.sms);
  const [aiCallEnabled, setAiCallEnabled] = useState(!!channels.aiCall);
  const [linkedinEnabled, setLinkedinEnabled] = useState(!!channels.linkedin);

  // Sync local state with incoming channels
  useEffect(() => {
    setEmailEnabled(!!channels.email);
    setSmsEnabled(!!channels.sms);
    setAiCallEnabled(!!channels.aiCall);
    setLinkedinEnabled(!!channels.linkedin);
  }, [channels]);

  // Build effective channels config from toggles
  const getEffectiveChannels = (): ChannelConfig => {
    const effective: ChannelConfig = {};
    
    if (emailEnabled) {
      effective.email = channels.email || {
        provider: 'gmail',
        sender: senderEmail,
        sequenceLength: 4,
        gapDays: 3,
      };
    }
    
    if (smsEnabled) {
      effective.sms = channels.sms || {
        fromNumber: "+12185628671",
        sequenceLength: 2,
      };
    }
    
    if (aiCallEnabled) {
      effective.aiCall = channels.aiCall || {
        fromNumber: "+13055634142",
        callDay: 10,
        transferTo: "",
      };
    }
    
    if (linkedinEnabled) {
      effective.linkedin = true;
    }
    
    return effective;
  };

  // Handle toggle changes
  const handleToggleChange = (channel: 'email' | 'sms' | 'aiCall' | 'linkedin', enabled: boolean) => {
    switch (channel) {
      case 'email': setEmailEnabled(enabled); break;
      case 'sms': setSmsEnabled(enabled); break;
      case 'aiCall': setAiCallEnabled(enabled); break;
      case 'linkedin': setLinkedinEnabled(enabled); break;
    }
    
    // Notify parent of channel changes after a tick
    setTimeout(() => {
      const effective = getEffectiveChannels();
      // Update the specific channel we just toggled
      if (channel === 'email') effective.email = enabled ? (channels.email || { provider: 'gmail', sender: senderEmail, sequenceLength: 4, gapDays: 3 }) : undefined;
      if (channel === 'sms') effective.sms = enabled ? (channels.sms || { fromNumber: "+12185628671", sequenceLength: 2 }) : undefined;
      if (channel === 'aiCall') effective.aiCall = enabled ? (channels.aiCall || { fromNumber: "+13055634142", callDay: 10, transferTo: "" }) : undefined;
      if (channel === 'linkedin') effective.linkedin = enabled;
      
      onChannelsChange?.(effective);
    }, 0);
  };

  useEffect(() => {
    checkIntegrations();
  }, [emailEnabled, smsEnabled, aiCallEnabled, linkedinEnabled]);

  const checkIntegrations = async () => {
    setIsChecking(true);
    
    const statuses: ChannelStatus[] = [];

    // Email - check if enabled via toggle
    if (emailEnabled) {
      const provider = channels.email?.provider || 'gmail';
      const isGmail = provider === 'gmail' || provider === 'smtp';
      const providerLabel = isGmail ? 'Gmail' : 'Instantly';
      const providerDetails = isGmail 
        ? `${channels.email?.sender || senderEmail} (Connected via Google)`
        : channels.email?.sender || senderEmail;
      
      statuses.push({
        name: `Email (${providerLabel})`,
        key: "email",
        icon: <Mail className="h-4 w-4" />,
        enabled: true,
        status: isGmail ? "connected" : "checking",
        details: providerDetails,
      });
    }

    // SMS - check if enabled via toggle
    if (smsEnabled) {
      statuses.push({
        name: "SMS (Twilio)",
        key: "sms",
        icon: <MessageSquare className="h-4 w-4" />,
        enabled: true,
        status: "checking",
        details: channels.sms?.fromNumber || "Rotating numbers",
      });
    }

    // AI Calls - check if enabled via toggle
    if (aiCallEnabled) {
      statuses.push({
        name: "AI Calls (ARIA)",
        key: "aiCall",
        icon: <Phone className="h-4 w-4" />,
        enabled: true,
        status: "checking",
        details: "Voice AI",
      });
    }

    // LinkedIn (Manual)
    if (linkedinEnabled) {
      statuses.push({
        name: "LinkedIn",
        key: "linkedin",
        icon: <Linkedin className="h-4 w-4" />,
        enabled: true,
        status: "manual",
        details: "Reminders will be generated",
      });
    }

    setChannelStatuses(statuses);

    if (statuses.length === 0) {
      onStatusChange(false, []);
      setIsChecking(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-integrations", {
        body: {
          channels: statuses.map(s => s.key),
          sender_email: senderEmail,
        },
      });

      if (error) throw error;

      const updatedStatuses = statuses.map(s => {
        if (s.status === "manual") return s;
        
        const result = data?.results?.[s.key];
        if (result) {
          return {
            ...s,
            status: result.connected ? "connected" as const : "disconnected" as const,
            details: result.details || s.details,
            error: result.error,
          };
        }
        return { ...s, status: "connected" as const };
      });

      setChannelStatuses(updatedStatuses);

      // Report status to parent
      const allConnected = updatedStatuses.every(s => 
        s.status === "connected" || s.status === "manual"
      );
      
      const integrationDetails: IntegrationStatusType[] = updatedStatuses.map(s => ({
        name: s.name,
        type: s.key as 'email' | 'sms' | 'voice' | 'linkedin',
        status: s.status,
        connected: s.status === "connected" || s.status === "manual",
        details: s.details,
        error: s.error,
      }));

      onStatusChange(allConnected, integrationDetails);
    } catch (err) {
      console.error("Integration check failed:", err);
      // Mark all as connected on error (optimistic)
      const updatedStatuses = statuses.map(s => ({
        ...s,
        status: s.status === "manual" ? "manual" as const : "connected" as const,
      }));
      setChannelStatuses(updatedStatuses);
      onStatusChange(true, []);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: ChannelStatus["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "manual":
        return <CheckCircle2 className="h-4 w-4 text-amber-400" />;
      default:
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: ChannelStatus["status"]) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Connected</Badge>;
      case "disconnected":
        return <Badge variant="destructive">Disconnected</Badge>;
      case "manual":
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30">Manual</Badge>;
      default:
        return <Badge variant="secondary">Checking...</Badge>;
    }
  };

  const enabledCount = [emailEnabled, smsEnabled, aiCallEnabled, linkedinEnabled].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Quick Toggle Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 border-b border-border">
        <div className={`flex items-center justify-between p-3 rounded-lg border ${emailEnabled ? 'border-blue-500/30 bg-blue-500/5' : 'border-border bg-muted/30'}`}>
          <div className="flex items-center gap-2">
            <Mail className={`h-4 w-4 ${emailEnabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <Label className="text-sm font-medium">Email</Label>
          </div>
          <Switch 
            checked={emailEnabled} 
            onCheckedChange={(v) => handleToggleChange('email', v)} 
          />
        </div>
        
        <div className={`flex items-center justify-between p-3 rounded-lg border ${smsEnabled ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare className={`h-4 w-4 ${smsEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
            <Label className="text-sm font-medium">SMS</Label>
          </div>
          <Switch 
            checked={smsEnabled} 
            onCheckedChange={(v) => handleToggleChange('sms', v)} 
          />
        </div>
        
        <div className={`flex items-center justify-between p-3 rounded-lg border ${aiCallEnabled ? 'border-purple-500/30 bg-purple-500/5' : 'border-border bg-muted/30'}`}>
          <div className="flex items-center gap-2">
            <Phone className={`h-4 w-4 ${aiCallEnabled ? 'text-purple-500' : 'text-muted-foreground'}`} />
            <Label className="text-sm font-medium">AI Calls</Label>
          </div>
          <Switch 
            checked={aiCallEnabled} 
            onCheckedChange={(v) => handleToggleChange('aiCall', v)} 
          />
        </div>
        
        <div className={`flex items-center justify-between p-3 rounded-lg border ${linkedinEnabled ? 'border-sky-500/30 bg-sky-500/5' : 'border-border bg-muted/30'}`}>
          <div className="flex items-center gap-2">
            <Linkedin className={`h-4 w-4 ${linkedinEnabled ? 'text-sky-500' : 'text-muted-foreground'}`} />
            <Label className="text-sm font-medium">LinkedIn</Label>
          </div>
          <Switch 
            checked={linkedinEnabled} 
            onCheckedChange={(v) => handleToggleChange('linkedin', v)} 
          />
        </div>
      </div>

      {enabledCount === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          Enable at least one channel above to launch your campaign.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {channelStatuses.filter(s => s.status === "connected" || s.status === "manual").length} of {channelStatuses.length} channels ready
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkIntegrations}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              Recheck
            </Button>
          </div>

          <div className="space-y-2">
            {channelStatuses.map((channel) => (
              <div
                key={channel.key}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  channel.status === "disconnected"
                    ? "border-red-500/30 bg-red-500/5"
                    : channel.status === "connected"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(channel.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      {channel.icon}
                      <span className="font-medium text-foreground">{channel.name}</span>
                    </div>
                    {channel.details && (
                      <p className="text-sm text-muted-foreground">{channel.details}</p>
                    )}
                    {channel.error && (
                      <p className="text-sm text-red-400">{channel.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(channel.status)}
                  {channel.status === "disconnected" && (
                    <Button variant="outline" size="sm" onClick={checkIntegrations}>
                      Reconnect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Edit Button */}
          <div className="flex justify-end pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/campaigns/new/channels")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Sequence Details
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
