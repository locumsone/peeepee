import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, Linkedin, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { IntegrationStatus as IntegrationStatusType, ChannelConfig } from "./types";

interface IntegrationStatusProps {
  channels: ChannelConfig;
  senderEmail?: string;
  onStatusChange?: (allConnected: boolean, details?: IntegrationStatusType[]) => void;
}

export function IntegrationStatus({ channels, senderEmail, onStatusChange }: IntegrationStatusProps) {
  const [integrations, setIntegrations] = useState<IntegrationStatusType[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkIntegrations = async () => {
    setIsChecking(true);
    
    const newIntegrations: IntegrationStatusType[] = [];

    // Check Email (Instantly)
    if (channels.email) {
      newIntegrations.push({
        name: "Instantly",
        type: "email",
        status: "checking",
        details: "Verifying connection...",
      });
    }

    // Check SMS (Twilio)
    if (channels.sms) {
      newIntegrations.push({
        name: "Twilio SMS",
        type: "sms",
        status: "checking",
        details: "Verifying connection...",
      });
    }

    // Check Voice (Twilio/Retell)
    if (channels.aiCall) {
      newIntegrations.push({
        name: "ARIA Voice",
        type: "voice",
        status: "checking",
        details: "Verifying connection...",
      });
    }

    // LinkedIn is always manual
    if (channels.linkedin) {
      newIntegrations.push({
        name: "LinkedIn",
        type: "linkedin",
        status: "manual",
        details: "Reminders will be generated",
      });
    }

    setIntegrations(newIntegrations);

    try {
      const { data, error } = await supabase.functions.invoke("check-integrations", {
        body: {
          checkEmail: !!channels.email,
          checkSms: !!channels.sms,
          checkVoice: !!channels.aiCall,
          senderEmail,
        },
      });

      if (error) throw error;

      const updatedIntegrations = newIntegrations.map((integration) => {
        if (integration.type === "email" && data?.instantly) {
          return {
            ...integration,
            status: data.instantly.connected ? "connected" : "disconnected",
            details: data.instantly.connected 
              ? `${senderEmail || "Email sender"} ready`
              : data.instantly.error || "Connection failed",
            account: senderEmail,
          } as IntegrationStatusType;
        }
        if (integration.type === "sms" && data?.twilio) {
          return {
            ...integration,
            status: data.twilio.connected ? "connected" : "disconnected",
            details: data.twilio.connected
              ? data.twilio.phoneNumber || "SMS ready"
              : data.twilio.error || "Connection failed",
            account: data.twilio.phoneNumber,
          } as IntegrationStatusType;
        }
        if (integration.type === "voice" && data?.retell) {
          return {
            ...integration,
            status: data.retell.connected ? "connected" : "disconnected",
            details: data.retell.connected
              ? "ARIA AI ready"
              : data.retell.error || "Connection failed",
          } as IntegrationStatusType;
        }
        return integration;
      });

      setIntegrations(updatedIntegrations);
      
      const allConnected = updatedIntegrations.every(
        (i) => i.status === "connected" || i.status === "manual"
      );
      onStatusChange?.(allConnected, updatedIntegrations);
    } catch (err) {
      console.error("Integration check failed:", err);
      // Mark all as disconnected on error
      const errorIntegrations = newIntegrations.map((i) => ({
        ...i,
        status: i.type === "linkedin" ? "manual" : "disconnected",
        details: i.type === "linkedin" ? i.details : "Check failed",
      } as IntegrationStatusType));
      setIntegrations(errorIntegrations);
      onStatusChange?.(false, errorIntegrations);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Auto-check on mount if channels are configured
    if (channels.email || channels.sms || channels.aiCall || channels.linkedin) {
      checkIntegrations();
    }
  }, [channels.email, channels.sms, channels.aiCall, channels.linkedin]);

  const getStatusIcon = (status: IntegrationStatusType["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "checking":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "manual":
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getTypeIcon = (type: IntegrationStatusType["type"]) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "voice":
        return <Phone className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
    }
  };

  if (integrations.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Integration Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkIntegrations}
            disabled={isChecking}
            className="text-muted-foreground hover:text-foreground"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {integrations.map((integration, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                {getTypeIcon(integration.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {integration.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {integration.details}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(integration.status)}
              <span
                className={`text-xs font-medium capitalize ${
                  integration.status === "connected"
                    ? "text-green-400"
                    : integration.status === "disconnected"
                    ? "text-red-400"
                    : integration.status === "manual"
                    ? "text-yellow-400"
                    : "text-muted-foreground"
                }`}
              >
                {integration.status}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
