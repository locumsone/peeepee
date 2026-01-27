import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mail, MessageSquare, Phone, TrendingUp, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OutreachMetrics {
  totalLeads: number;
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  smsSent: number;
  smsReplied: number;
  callsAttempted: number;
  callsConnected: number;
}

interface JobOutreachStatsProps {
  metrics: OutreachMetrics;
}

export const JobOutreachStats = ({ metrics }: JobOutreachStatsProps) => {
  const emailOpenRate = metrics.emailsSent > 0 
    ? ((metrics.emailsOpened / metrics.emailsSent) * 100).toFixed(1) 
    : "0";
  const emailReplyRate = metrics.emailsSent > 0 
    ? ((metrics.emailsReplied / metrics.emailsSent) * 100).toFixed(1) 
    : "0";
  const smsReplyRate = metrics.smsSent > 0 
    ? ((metrics.smsReplied / metrics.smsSent) * 100).toFixed(1) 
    : "0";
  const callConnectRate = metrics.callsAttempted > 0 
    ? ((metrics.callsConnected / metrics.callsAttempted) * 100).toFixed(1) 
    : "0";

  const totalReplies = metrics.emailsReplied + metrics.smsReplied;
  const totalOutreach = metrics.emailsSent + metrics.smsSent + metrics.callsAttempted;
  const overallResponseRate = totalOutreach > 0 
    ? ((totalReplies / totalOutreach) * 100).toFixed(1) 
    : "0";

  return (
    <div className="space-y-6">
      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{metrics.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{overallResponseRate}%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReplies}</p>
                <p className="text-xs text-muted-foreground">Total Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalOutreach}</p>
                <p className="text-xs text-muted-foreground">Total Touches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-400" />
              Email Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Sent</span>
                <span className="text-foreground font-medium">{metrics.emailsSent}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Open Rate</span>
                <span className="text-foreground font-medium">{emailOpenRate}%</span>
              </div>
              <Progress value={parseFloat(emailOpenRate)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Reply Rate</span>
                <span className={cn(
                  "font-medium",
                  parseFloat(emailReplyRate) >= 5 ? "text-success" : "text-foreground"
                )}>{emailReplyRate}%</span>
              </div>
              <Progress value={parseFloat(emailReplyRate) * 5} className="h-2" />
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {metrics.emailsReplied} replies received
              </span>
            </div>
          </CardContent>
        </Card>

        {/* SMS */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              SMS Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Sent</span>
                <span className="text-foreground font-medium">{metrics.smsSent}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Reply Rate</span>
                <span className={cn(
                  "font-medium",
                  parseFloat(smsReplyRate) >= 10 ? "text-success" : "text-foreground"
                )}>{smsReplyRate}%</span>
              </div>
              <Progress value={parseFloat(smsReplyRate) * 2} className="h-2" />
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {metrics.smsReplied} replies received
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Calls */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-400" />
              Call Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Attempted</span>
                <span className="text-foreground font-medium">{metrics.callsAttempted}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Connect Rate</span>
                <span className={cn(
                  "font-medium",
                  parseFloat(callConnectRate) >= 30 ? "text-success" : "text-foreground"
                )}>{callConnectRate}%</span>
              </div>
              <Progress value={parseFloat(callConnectRate)} className="h-2" />
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {metrics.callsConnected} calls connected
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JobOutreachStats;
