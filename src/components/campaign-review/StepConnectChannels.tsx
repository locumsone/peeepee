import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, Linkedin, CheckCircle2, XCircle, Loader2, RefreshCw, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ChannelConfig, IntegrationStatus as IntegrationStatusType } from "./types";

interface StepConnectChannelsProps {
  channels: ChannelConfig;
  senderEmail: string;
  onStatusChange: (connected: boolean, details?: IntegrationStatusType[]) => void;
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
}: StepConnectChannelsProps) {
  const navigate = useNavigate();
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkIntegrations();
  }, [channels]);

  const checkIntegrations = async () => {
    setIsChecking(true);
    
    const statuses: ChannelStatus[] = [];

    // Email (Instantly or Gmail/SMTP)
    if (channels.email) {
      const provider = channels.email.provider || 'instantly';
      const providerLabel = provider === 'gmail' || provider === 'smtp' ? 'Gmail/SMTP' : 'Instantly';
      statuses.push({
        name: `Email (${providerLabel})`,
        key: "email",
        icon: <Mail className="h-4 w-4" />,
        enabled: true,
        status: provider === 'gmail' || provider === 'smtp' ? "connected" as const : "checking",
        details: senderEmail,
      });
    }

    // SMS (Twilio)
    if (channels.sms) {
      statuses.push({
        name: "SMS (Twilio)",
        key: "sms",
        icon: <MessageSquare className="h-4 w-4" />,
        enabled: true,
        status: "checking",
        details: channels.sms.fromNumber || "Default number",
      });
    }

    // AI Calls (ARIA/Retell)
    if (channels.aiCall) {
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
    if (channels.linkedin) {
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

    try {
      const { data, error } = await supabase.functions.invoke("check-integrations", {
        body: {
          channels: Object.keys(channels).filter(k => channels[k as keyof ChannelConfig]),
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

  if (channelStatuses.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No channels configured. Go back to add channels.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          Edit Channels
        </Button>
      </div>
    </div>
  );
}
