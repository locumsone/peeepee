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
  BarChart3
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsNeedingAttention, setJobsNeedingAttention] = useState(0);
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

    try {
      // Fetch recent active jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["active", "open"])
        .order("created_at", { ascending: false })
        .limit(6);

      setJobs(jobsData || []);

      // Count jobs without campaigns
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "open"]);

      setJobsNeedingAttention(count || 0);
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
              {jobsNeedingAttention > 0 && (
                <span className="ml-2 text-primary">
                  • {jobsNeedingAttention} active job{jobsNeedingAttention !== 1 ? "s" : ""} need candidates
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
                <Briefcase className="h-4 w-4 text-primary" />
                Your Active Jobs
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
                  <p className="text-sm">No active jobs</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => navigate("/jobs/new")}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create Your First Job
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
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
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
