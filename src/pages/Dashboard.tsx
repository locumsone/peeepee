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
  MessageSquare,
  PhoneCall,
  Eye,
  Star,
  Clock,
  User
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ActivityItem {
  id: string;
  action_type: string;
  user_name: string;
  metadata: Json | null;
  created_at: string;
}

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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  const userName = "Recruiter"; // Would come from auth context
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
      // Fetch all stats in parallel
      const [
        campaignsRes,
        hotLeadsRes,
        callsRes,
        placementsRes,
        activityRes,
        callbacksRes,
      ] = await Promise.all([
        // Active campaigns count
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        
        // Hot leads (replies today)
        supabase
          .from("activity_log")
          .select("id", { count: "exact", head: true })
          .eq("action_type", "reply")
          .gte("created_at", todayStart),
        
        // Calls today
        supabase
          .from("ai_call_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        
        // Placements this month
        supabase
          .from("campaign_leads_v2")
          .select("id", { count: "exact", head: true })
          .eq("status", "placed")
          .gte("created_at", monthStart),
        
        // Recent activity
        supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        
        // Upcoming callbacks from ai_call_queue
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

      setActivities(activityRes.data || []);
      setCallbacks(callbacksRes.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email_opened":
        return <Eye className="h-4 w-4 text-blue-400" />;
      case "sms_reply":
      case "reply":
        return <MessageSquare className="h-4 w-4 text-green-400" />;
      case "call_completed":
        return <PhoneCall className="h-4 w-4 text-purple-400" />;
      case "interested_signal":
        return <Star className="h-4 w-4 text-yellow-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityDescription = (activity: ActivityItem) => {
    const metadata = activity.metadata as Record<string, unknown> | null;
    const candidateName = (metadata?.candidate_name as string) || "Unknown";
    
    switch (activity.action_type) {
      case "email_opened":
        return `${candidateName} opened an email`;
      case "sms_reply":
      case "reply":
        return `${candidateName} replied to message`;
      case "call_completed":
        return `Call completed with ${candidateName}`;
      case "interested_signal":
        return `${candidateName} showed interest`;
      default:
        return `${activity.action_type} by ${activity.user_name}`;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {greeting}, {userName}
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Campaigns</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.activeCampaigns}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Megaphone className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hot Leads Today</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.hotLeads}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Flame className="h-6 w-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Calls Today</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.callsToday}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Placements MTD</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "—" : stats.placementsMTD}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            asChild
            variant="outline"
            className="h-16 flex items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Link to="/jobs/new">
              <FileText className="h-5 w-5" />
              <span>New Job</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-16 flex items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Link to="/candidates/search">
              <Search className="h-5 w-5" />
              <span>Find Candidates</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-16 flex items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Link to="/inbox/sms">
              <Mail className="h-5 w-5" />
              <span>Check Inbox</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-16 flex items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Link to="/campaigns">
              <BarChart3 className="h-5 w-5" />
              <span>View Campaigns</span>
            </Link>
          </Button>
        </div>

        {/* Activity Feed & Callbacks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading activity...
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="mt-0.5">
                          {getActivityIcon(activity.action_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {getActivityDescription(activity)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Upcoming Callbacks */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Upcoming Callbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading callbacks...
                  </div>
                ) : callbacks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No upcoming callbacks
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callbacks.map((callback) => (
                      <div
                        key={callback.id}
                        className="p-3 rounded-lg bg-muted/50 space-y-2"
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
                          <p className="text-xs text-muted-foreground">
                            {String((callback.metadata as Record<string, unknown>).reason)}
                          </p>
                        )}
                        <Button
                          size="sm"
                          className="w-full mt-2 bg-primary hover:bg-primary/90"
                        >
                          <Phone className="h-3 w-3 mr-1" />
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
