import { Mail, MessageSquare, Phone, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignMetricsProps {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  smsSent: number;
  smsDelivered: number;
  smsReplied: number;
  callsAttempted: number;
  callsConnected: number;
  compact?: boolean;
}

export const CampaignMetrics = ({
  emailsSent,
  emailsOpened,
  emailsClicked,
  emailsReplied,
  emailsBounced,
  smsSent,
  smsDelivered,
  smsReplied,
  callsAttempted,
  callsConnected,
  compact = false,
}: CampaignMetricsProps) => {
  // Calculate rates
  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
  const clickRate = emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0;
  const replyRate = emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0;
  const bounceRate = emailsSent > 0 ? (emailsBounced / emailsSent) * 100 : 0;
  const smsDeliveryRate = smsSent > 0 ? (smsDelivered / smsSent) * 100 : 0;
  const smsReplyRate = smsSent > 0 ? (smsReplied / smsSent) * 100 : 0;
  const callConnectRate = callsAttempted > 0 ? (callsConnected / callsAttempted) * 100 : 0;

  // Health indicators
  const getHealthIndicator = (rate: number, thresholds: { good: number; warning: number }) => {
    if (rate >= thresholds.good) return { color: "text-success", bg: "bg-success/10", icon: TrendingUp };
    if (rate >= thresholds.warning) return { color: "text-warning", bg: "bg-warning/10", icon: Minus };
    return { color: "text-destructive", bg: "bg-destructive/10", icon: TrendingDown };
  };

  const emailHealth = getHealthIndicator(openRate, { good: 30, warning: 15 });
  const smsHealth = getHealthIndicator(smsDeliveryRate, { good: 90, warning: 70 });
  const callHealth = getHealthIndicator(callConnectRate, { good: 30, warning: 15 });

  if (compact) {
    // Compact view for table rows
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono tabular-nums">
            {emailsSent} | {openRate.toFixed(0)}% | {replyRate.toFixed(0)}%
          </span>
        </div>
        {smsSent > 0 && (
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono tabular-nums">{smsSent}</span>
          </div>
        )}
        {callsAttempted > 0 && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono tabular-nums">{callsConnected}/{callsAttempted}</span>
          </div>
        )}
      </div>
    );
  }

  // Full dashboard view
  return (
    <div className="space-y-6">
      {/* Email Metrics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Email Performance</h4>
          <div className={cn("ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", emailHealth.bg, emailHealth.color)}>
            <emailHealth.icon className="h-3 w-3" />
            {openRate >= 30 ? "Healthy" : openRate >= 15 ? "Needs Attention" : "Low Engagement"}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Sent" value={emailsSent} />
          <MetricCard label="Opened" value={emailsOpened} rate={openRate} rateLabel="Open Rate" />
          <MetricCard label="Clicked" value={emailsClicked} rate={clickRate} rateLabel="Click Rate" />
          <MetricCard label="Replied" value={emailsReplied} rate={replyRate} rateLabel="Reply Rate" highlight />
          <MetricCard label="Bounced" value={emailsBounced} rate={bounceRate} rateLabel="Bounce Rate" negative />
        </div>
      </div>

      {/* SMS Metrics */}
      {smsSent > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">SMS Performance</h4>
            <div className={cn("ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", smsHealth.bg, smsHealth.color)}>
              <smsHealth.icon className="h-3 w-3" />
              {smsDeliveryRate >= 90 ? "Healthy" : smsDeliveryRate >= 70 ? "Needs Attention" : "Issues Detected"}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Sent" value={smsSent} />
            <MetricCard label="Delivered" value={smsDelivered} rate={smsDeliveryRate} rateLabel="Delivery Rate" />
            <MetricCard label="Replied" value={smsReplied} rate={smsReplyRate} rateLabel="Reply Rate" highlight />
          </div>
        </div>
      )}

      {/* Call Metrics */}
      {callsAttempted > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Call Performance</h4>
            <div className={cn("ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", callHealth.bg, callHealth.color)}>
              <callHealth.icon className="h-3 w-3" />
              {callConnectRate >= 30 ? "Good" : callConnectRate >= 15 ? "Average" : "Low Connect Rate"}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Attempted" value={callsAttempted} />
            <MetricCard label="Connected" value={callsConnected} rate={callConnectRate} rateLabel="Connect Rate" highlight />
          </div>
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
  rate?: number;
  rateLabel?: string;
  highlight?: boolean;
  negative?: boolean;
}

const MetricCard = ({ label, value, rate, rateLabel, highlight, negative }: MetricCardProps) => (
  <div className={cn(
    "rounded-lg p-3 border",
    highlight ? "bg-primary/5 border-primary/20" : 
    negative ? "bg-destructive/5 border-destructive/20" : 
    "bg-muted/30 border-border"
  )}>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={cn(
      "text-xl font-bold tabular-nums",
      highlight ? "text-primary" : negative ? "text-destructive" : "text-foreground"
    )}>
      {value.toLocaleString()}
    </p>
    {rate !== undefined && (
      <p className={cn(
        "text-xs mt-0.5 tabular-nums",
        highlight ? "text-primary/70" : negative ? "text-destructive/70" : "text-muted-foreground"
      )}>
        {rate.toFixed(1)}% {rateLabel}
      </p>
    )}
  </div>
);

export default CampaignMetrics;
