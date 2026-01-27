import { useEffect, useState } from "react";
import { Briefcase, Users, MessageSquare, Phone, TrendingUp, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  activeJobs: number;
  enrichedCandidates: number;
  smsThisWeek: number;
  callsThisWeek: number;
  emailsSent: number;
  responseRate: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    activeJobs: 0,
    enrichedCandidates: 0,
    smsThisWeek: 0,
    callsThisWeek: 0,
    emailsSent: 0,
    responseRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [jobsRes, candidatesRes, smsRes, callsRes, campaignsRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "open"]),
        supabase
          .from("candidates")
          .select("id", { count: "exact", head: true })
          .or("personal_mobile.not.is.null,personal_email.not.is.null"),
        supabase
          .from("sms_messages")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from("ai_call_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from("campaigns")
          .select("emails_sent, emails_replied")
          .eq("status", "active"),
      ]);

      // Calculate response rate from campaign data
      const totalSent = campaignsRes.data?.reduce((sum, c) => sum + (c.emails_sent || 0), 0) || 0;
      const totalReplied = campaignsRes.data?.reduce((sum, c) => sum + (c.emails_replied || 0), 0) || 0;
      const rate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

      setStats({
        activeJobs: jobsRes.count || 0,
        enrichedCandidates: candidatesRes.count || 0,
        smsThisWeek: smsRes.count || 0,
        callsThisWeek: callsRes.count || 0,
        emailsSent: totalSent,
        responseRate: rate,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Active Jobs",
      value: stats.activeJobs,
      icon: Briefcase,
      accent: "bg-primary/10 text-primary",
      description: "Open positions",
    },
    {
      title: "Enriched Candidates",
      value: stats.enrichedCandidates,
      icon: Users,
      accent: "bg-emerald-500/10 text-emerald-500",
      description: "With contact info",
    },
    {
      title: "SMS This Week",
      value: stats.smsThisWeek,
      icon: MessageSquare,
      accent: "bg-blue-500/10 text-blue-500",
      description: "Messages sent",
    },
    {
      title: "Calls This Week",
      value: stats.callsThisWeek,
      icon: Phone,
      accent: "bg-violet-500/10 text-violet-500",
      description: "Completed calls",
    },
    {
      title: "Emails Sent",
      value: stats.emailsSent,
      icon: Mail,
      accent: "bg-amber-500/10 text-amber-500",
      description: "Campaign emails",
    },
    {
      title: "Response Rate",
      value: `${stats.responseRate}%`,
      icon: TrendingUp,
      accent: "bg-cyan-500/10 text-cyan-500",
      description: "Email replies",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((stat) => (
        <Card 
          key={stat.title} 
          className="group hover:border-primary/30 transition-all duration-200"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.accent}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? "—" : stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stat.title}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
