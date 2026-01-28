import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  Plus, 
  Briefcase, 
  Zap,
  ArrowRight,
  Users,
  Search,
  Mail,
  BarChart3,
  UserCircle
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  DashboardStats, 
  DashboardJobCard, 
  DashboardActivityFeed,
  DashboardPipeline 
} from "@/components/dashboard";

interface Job {
  id: string;
  job_name: string | null;
  specialty: string | null;
  state: string | null;
  city: string | null;
  facility_name: string | null;
  status: string | null;
  pay_rate: number | null;
  created_at: string | null;
}

interface JobAssignment {
  job_id: string;
  role: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobIds, setMyJobIds] = useState<Set<string>>(new Set());
  const [jobsNeedingAttention, setJobsNeedingAttention] = useState(0);
  const [loading, setLoading] = useState(true);

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Recruiter";
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch user's job assignments
      const { data: assignments } = await supabase
        .from("job_assignments")
        .select("job_id, role")
        .eq("user_id", user.id);

      const assignedJobIds = new Set((assignments || []).map(a => a.job_id));
      setMyJobIds(assignedJobIds);

      // Fetch jobs - prioritize assigned jobs
      let jobsQuery = supabase
        .from("jobs")
        .select("*")
        .in("status", ["active", "open"])
        .order("created_at", { ascending: false })
        .limit(6);

      // If user has assigned jobs, prioritize those
      if (assignedJobIds.size > 0) {
        const { data: assignedJobs } = await supabase
          .from("jobs")
          .select("*")
          .in("id", Array.from(assignedJobIds))
          .in("status", ["active", "open"])
          .order("created_at", { ascending: false })
          .limit(6);

        setJobs(assignedJobs || []);
      } else {
        const { data: jobsData } = await jobsQuery;
        setJobs(jobsData || []);
      }

      // Count jobs assigned to user
      setJobsNeedingAttention(assignedJobIds.size);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "New Job", icon: Plus, to: "/jobs/new", variant: "default" as const },
    { label: "Find Candidates", icon: Search, to: "/candidates/search", variant: "outline" as const },
    { label: "View Inbox", icon: Mail, to: "/communications", variant: "outline" as const },
    { label: "Campaigns", icon: BarChart3, to: "/campaigns", variant: "outline" as const },
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
              {myJobIds.size > 0 && (
                <span className="ml-2 text-primary">
                  • {myJobIds.size} job{myJobIds.size !== 1 ? "s" : ""} assigned to you
                </span>
              )}
            </p>
          </div>
          <Button 
            variant="default" 
            className="gap-2"
            onClick={() => navigate("/jobs/new")}
          >
            <Zap className="h-4 w-4" />
            Quick Campaign
          </Button>
        </div>

        {/* Stats Grid - Real Data */}
        <DashboardStats />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              asChild
              variant={action.variant}
              className="h-11 justify-start gap-3 bg-card hover:bg-secondary hover:border-primary/40 transition-all"
            >
              <Link to={action.to}>
                <action.icon className="h-4 w-4" />
                <span>{action.label}</span>
                <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
              </Link>
            </Button>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs Section */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" />
                {myJobIds.size > 0 ? "Your Assigned Jobs" : "Recent Active Jobs"}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/jobs">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  Loading jobs...
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Briefcase className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No jobs assigned to you yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => navigate("/jobs")}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Browse Jobs
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {jobs.map((job) => (
                    <DashboardJobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Your Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardActivityFeed />
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Section */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Candidate Pipeline
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/campaigns">
                View Campaigns
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <DashboardPipeline />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
