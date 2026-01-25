import { useState } from "react";
import { Shield, CheckCircle2, AlertTriangle, Info, Loader2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { QualityIssue, QualityCheckResult, SelectedCandidate, ChannelConfig } from "./types";

interface QualityGateProps {
  jobId: string | null;
  campaignName: string;
  candidates: SelectedCandidate[];
  channels: ChannelConfig;
  senderEmail?: string;
  integrationsConnected: boolean;
  onResultChange?: (result: QualityCheckResult | null) => void;
}

export function QualityGate({
  jobId,
  campaignName,
  candidates,
  channels,
  senderEmail,
  integrationsConnected,
  onResultChange,
}: QualityGateProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<QualityCheckResult | null>(null);

  const runQualityCheck = async () => {
    if (!jobId) return;

    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-quality-check", {
        body: {
          job_id: jobId,
          campaign_name: campaignName,
          candidates: candidates.map((c) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email || c.personal_email,
            phone: c.phone || c.personal_mobile,
            specialty: c.specialty,
            personalization_hook: c.icebreaker,
          })),
          channels,
          sender_email: senderEmail,
          email_sequence_count: channels.email?.sequenceLength || 0,
          sms_sequence_count: channels.sms?.sequenceLength || 0,
        },
      });

      if (error) throw error;

      // Add integration check to results
      const integrationIssue: QualityIssue | null = !integrationsConnected
        ? {
            severity: "critical",
            category: "Integrations",
            description: "One or more integrations are disconnected",
            suggestion: "Check integration status and reconnect before launching",
          }
        : null;

      const finalResult: QualityCheckResult = {
        ...data,
        issues: integrationIssue ? [integrationIssue, ...data.issues] : data.issues,
        can_launch: data.can_launch && integrationsConnected,
        summary: {
          ...data.summary,
          critical: data.summary.critical + (integrationIssue ? 1 : 0),
        },
      };

      setResult(finalResult);
      onResultChange?.(finalResult);
    } catch (err) {
      console.error("Quality check failed:", err);
      const errorResult: QualityCheckResult = {
        can_launch: false,
        issues: [
          {
            severity: "critical",
            category: "System",
            description: "Quality check failed to complete",
            suggestion: "Please try again or contact support",
          },
        ],
        summary: { critical: 1, warnings: 0, info: 0 },
      };
      setResult(errorResult);
      onResultChange?.(errorResult);
    } finally {
      setIsChecking(false);
    }
  };

  const getSeverityIcon = (severity: QualityIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getSeverityBadge = (severity: QualityIssue["severity"]) => {
    const colors = {
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return colors[severity];
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quality Gate
          </CardTitle>
          <Button
            variant={result ? "outline" : "default"}
            size="sm"
            onClick={runQualityCheck}
            disabled={isChecking || !jobId}
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {result ? "Re-check" : "Run Check"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !isChecking && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Run quality check to validate your campaign</p>
          </div>
        )}

        {isChecking && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing campaign configuration...</p>
          </div>
        )}

        {result && !isChecking && (
          <>
            {/* Summary */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                result.can_launch
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.can_launch ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                )}
                <span
                  className={`font-medium ${
                    result.can_launch ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {result.can_launch ? "Ready to Launch" : "Issues Found"}
                </span>
              </div>
              <div className="flex gap-2">
                {result.summary.critical > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    {result.summary.critical} Critical
                  </Badge>
                )}
                {result.summary.warnings > 0 && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    {result.summary.warnings} Warnings
                  </Badge>
                )}
                {result.summary.info > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {result.summary.info} Info
                  </Badge>
                )}
              </div>
            </div>

            {/* Issues List */}
            {result.issues.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={getSeverityBadge(issue.severity)}
                        >
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{issue.description}</p>
                      {issue.suggestion && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.issues.length === 0 && result.can_launch && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm text-muted-foreground">
                  All checks passed. Your campaign is ready to launch.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
