import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, Loader2, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface Job {
  id: string;
  job_name: string | null;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  pay_rate: number | null;
  bill_rate: number | null;
  status: string | null;
  start_date: string | null;
  created_at: string | null;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  on_hold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  filled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, job_name, facility_name, city, state, pay_rate, bill_rate, status, start_date, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching jobs:", error);
    } else {
      setJobs(data || []);
    }
    setIsLoading(false);
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    return job.status === filter;
  });

  const formatPayRate = (rate: number | null) => {
    if (!rate) return "—";
    return `$${rate}/hr`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "MMM d, yyyy");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
            <p className="text-muted-foreground mt-1">Manage your locum tenens positions</p>
          </div>
          <Button 
            onClick={() => navigate("/")}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="on_hold">On Hold</TabsTrigger>
            <TabsTrigger value="filled">Filled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No jobs found</p>
          </div>
        )}

        {/* Jobs Grid */}
        {!isLoading && filteredJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-foreground line-clamp-1">
                      {job.job_name || "Untitled Job"}
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className={statusColors[job.status || "closed"]}
                    >
                      {job.status?.replace("_", " ") || "unknown"}
                    </Badge>
                  </div>
                  {job.facility_name && (
                    <p className="text-sm text-muted-foreground">{job.facility_name}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Location */}
                  {(job.city || job.state) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{[job.city, job.state].filter(Boolean).join(", ")}</span>
                    </div>
                  )}

                  {/* Rates */}
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-emerald-400">
                      {formatPayRate(job.pay_rate)}
                    </span>
                    {job.bill_rate && (
                      <span className="text-sm text-muted-foreground">
                        Bill: ${job.bill_rate}/hr
                      </span>
                    )}
                  </div>

                  {/* Start Date */}
                  {job.start_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Starts {formatDate(job.start_date)}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button 
                    variant="outline" 
                    className="w-full mt-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => navigate(`/candidates?jobId=${job.id}`)}
                  >
                    Start Campaign
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
