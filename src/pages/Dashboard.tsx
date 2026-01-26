import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, startOfMonth } from "date-fns";
import { 
  Megaphone, 
  Flame, 
  Phone, 
  Trophy,
  FileText,
  Search,
  Mail,
  BarChart3,
  Clock,
  User,
  ArrowUpRight,
  Zap
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { Json } from "@/integrations/supabase/types";

interface Callback {
  id: string;
  candidate_name: string | null;
  phone: string;
  scheduled_at: string | null;
  metadata: Json | null;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeCampaigns: 0,
    hotLeads: 0,
    callsToday: 0,
    placementsMTD: 0,
  });
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  const userName = "Recruiter";
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    const today = new Date();
    const todayStart = format(today, "yyyy-MM-dd");
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");

    try {
      const [
        campaignsRes,
        hotLeadsRes,
        callsRes,
        placementsRes,
        callbacksRes,
      ] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        
        supabase
          .from("activity_log")
          .select("id", { count: "exact", head: true })
          .eq("action_type", "reply")
          .gte("created_at", todayStart),
        
        supabase
          .from("ai_call_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        
        supabase
          .from("campaign_leads_v2")
          .select("id", { count: "exact", head: true })
          .eq("status", "placed")
          .gte("created_at", monthStart),
        
        supabase
          .from("ai_call_queue")
          .select("*")
          .eq("status", "queued")
          .gt("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5),
      ]);

      setStats({
        activeCampaigns: campaignsRes.count || 0,
        hotLeads: hotLeadsRes.count || 0,
        callsToday: callsRes.count || 0,
        placementsMTD: placementsRes.count || 0,
      });

      setCallbacks(callbacksRes.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Active Campaigns",
      value: stats.activeCampaigns,
      icon: Megaphone,
      accent: "bg-primary/10 text-primary",
    },
    {
      title: "Hot Leads Today",
      value: stats.hotLeads,
      icon: Flame,
      accent: "bg-warning/10 text-warning",
    },
    {
      title: "Calls Today",
      value: stats.callsToday,
      icon: Phone,
      accent: "bg-primary/10 text-primary",
    },
    {
      title: "Placements MTD",
      value: stats.placementsMTD,
      icon: Trophy,
      accent: "bg-success/10 text-success",
    },
  ];

  const quickActions = [
    { label: "New Job", icon: FileText, to: "/jobs/new" },
    { label: "Find Candidates", icon: Search, to: "/candidates/search" },
    { label: "Check Inbox", icon: Mail, to: "/inbox/sms" },
    { label: "View Campaigns", icon: BarChart3, to: "/campaigns" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {greeting}, {userName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <Button 
            variant="default" 
            className="gap-2"
            onClick={() => window.location.href = "/campaigns/new"}
          >
            <Zap className="h-4 w-4" />
            Quick Campaign
          </Button>
        </div>

        {/* Stats Grid - Xbox tile style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card 
              key={stat.title} 
              className="group cursor-pointer hover:border-primary/30 transition-all duration-200"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-foreground tabular-nums">
                      {loading ? "—" : stat.value}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.accent}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions - Xbox button row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="outline"
              className="h-12 justify-start gap-3 bg-card hover:bg-secondary hover:border-primary/40 transition-all"
            >
              <Link to={action.to}>
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <span>{action.label}</span>
                <ArrowUpRight className="h-3 w-3 ml-auto text-muted-foreground" />
              </Link>
            </Button>
          ))}
        </div>

        {/* Activity Feed & Callbacks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed filter={{ limit: 20 }} showCandidate={true} className="h-[380px]" />
            </CardContent>
          </Card>

          {/* Upcoming Callbacks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upcoming Callbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[380px] pr-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : callbacks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No upcoming callbacks</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callbacks.map((callback) => (
                      <div
                        key={callback.id}
                        className="p-3 rounded-lg bg-secondary/50 border border-border/50 space-y-2 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {callback.candidate_name || "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {callback.scheduled_at
                            ? format(new Date(callback.scheduled_at), "MMM d, h:mm a")
                            : "Not scheduled"}
                        </div>
                        {callback.metadata && typeof callback.metadata === 'object' && !Array.isArray(callback.metadata) && (callback.metadata as Record<string, unknown>).reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {String((callback.metadata as Record<string, unknown>).reason)}
                          </p>
                        )}
                        <Button
                          size="sm"
                          className="w-full mt-2"
                        >
                          <Phone className="h-3 w-3 mr-1.5" />
                          Call Now
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
