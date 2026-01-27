import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { 
  Search, Sparkles, Building2, MapPin, DollarSign, 
  Calendar, CheckCircle2, ArrowRight, Loader2, FileText,
  Clock, Briefcase
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Job {
  id: string;
  job_name: string | null;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  bill_rate: number | null;
  pay_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  schedule: string | null;
  requirements: string | null;
  status: string | null;
  created_at: string | null;
}

interface ParsedJob {
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  specialty: string;
  bill_rate: number;
  start_date: string;
  end_date: string;
  schedule: string;
  requirements: string;
}

const WIZARD_STEPS = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Channels" },
  { number: 4, label: "Review" },
];

const CampaignBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedJobId = searchParams.get("jobId");
  
  // Job selection state
  const [activeTab, setActiveTab] = useState<"select" | "create">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  
  // Job creation state
  const [rawJobText, setRawJobText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedJob, setParsedJob] = useState<ParsedJob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Editable parsed job fields
  const [editableJob, setEditableJob] = useState<ParsedJob | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  // Auto-select job if jobId is provided in URL
  useEffect(() => {
    if (preselectedJobId && jobs.length > 0 && !selectedJob) {
      const job = jobs.find(j => j.id === preselectedJobId);
      if (job) {
        setSelectedJob(job);
      }
    }
  }, [preselectedJobId, jobs, selectedJob]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleParseJob = async () => {
    if (!rawJobText.trim()) {
      toast.error("Please paste a job description");
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-parser`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ raw_text: rawJobText }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to parse job");
      }

      const data = await response.json();
      const parsed: ParsedJob = {
        job_name: data.job_name || data.specialty || "New Job",
        facility_name: data.facility_name || data.facility || "",
        city: data.city || "",
        state: data.state || "",
        specialty: data.specialty || "",
        bill_rate: data.bill_rate || 0,
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        schedule: data.schedule || "",
        requirements: data.requirements || "",
      };
      
      setParsedJob(parsed);
      setEditableJob(parsed);
      toast.success("Job parsed successfully!");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse job description");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveJob = async () => {
    if (!editableJob) return;

    setIsSaving(true);
    try {
      const payRate = Math.round(editableJob.bill_rate * 0.73);
      
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          job_name: editableJob.job_name,
          facility_name: editableJob.facility_name,
          city: editableJob.city,
          state: editableJob.state,
          specialty: editableJob.specialty,
          bill_rate: editableJob.bill_rate,
          pay_rate: payRate,
          start_date: editableJob.start_date || null,
          end_date: editableJob.end_date || null,
          schedule: editableJob.schedule,
          requirements: editableJob.requirements,
          status: "active",
          raw_job_text: rawJobText,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Job saved successfully!");
      setSelectedJob(data);
      setJobs(prev => [data, ...prev]);
      setParsedJob(null);
      setEditableJob(null);
      setRawJobText("");
      setActiveTab("select");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save job");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (!selectedJob) return;
    sessionStorage.setItem("campaign_job_id", selectedJob.id);
    sessionStorage.setItem("campaign_job", JSON.stringify(selectedJob));
    // Navigate to AI candidate matching page with job context
    navigate(`/candidates/matching?jobId=${selectedJob.id}`);
  };

  const filteredJobs = jobs.filter(job => {
    const query = searchQuery.toLowerCase();
    return (
      job.job_name?.toLowerCase().includes(query) ||
      job.facility_name?.toLowerCase().includes(query) ||
      job.specialty?.toLowerCase().includes(query) ||
      job.city?.toLowerCase().includes(query) ||
      job.state?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculatePayRate = (billRate: number | null) => {
    if (!billRate) return 0;
    return Math.round(billRate * 0.73);
  };

  return (
    <Layout showSteps={false}>
      <div className="mx-auto max-w-5xl space-y-8 pb-8">
        {/* Step Indicator */}
        <div className="w-full py-6">
          <div className="flex items-center justify-center">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all duration-300",
                      step.number === 1
                        ? "gradient-primary border-transparent text-primary-foreground shadow-glow"
                        : "border-muted bg-muted text-muted-foreground"
                    )}
                  >
                    {step.number}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium transition-colors duration-300",
                      step.number === 1 ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 w-12 sm:w-20 md:w-32 rounded-full transition-all duration-500 bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Select or Create Job
          </h1>
          <p className="text-muted-foreground">
            Choose an existing job or create a new one to start your campaign
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Select Existing Job Card */}
          <Card 
            className={cn(
              "cursor-pointer transition-all duration-200 border-2",
              activeTab === "select" 
                ? "border-primary shadow-glow" 
                : "border-border hover:border-primary/50"
            )}
            onClick={() => setActiveTab("select")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  activeTab === "select" ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Select Existing Job</CardTitle>
                  <CardDescription>Choose from your job listings</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Create New Job Card */}
          <Card 
            className={cn(
              "cursor-pointer transition-all duration-200 border-2",
              activeTab === "create" 
                ? "border-primary shadow-glow" 
                : "border-border hover:border-primary/50"
            )}
            onClick={() => setActiveTab("create")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  activeTab === "create" ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Create New Job</CardTitle>
                  <CardDescription>Parse a job description with AI</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Select Existing Job Content */}
        {activeTab === "select" && (
          <Card className="animate-fade-in">
            <CardContent className="p-6 space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Jobs List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {isLoadingJobs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No jobs found
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all",
                        selectedJob?.id === job.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {job.job_name || job.specialty || "Untitled Job"}
                            </span>
                            {selectedJob?.id === job.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {job.facility_name || "No facility"}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {job.city && job.state ? `${job.city}, ${job.state}` : "No location"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-1 text-sm font-medium text-primary">
                            <DollarSign className="h-3.5 w-3.5" />
                            ${calculatePayRate(job.bill_rate)}/hr
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(job.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create New Job Content */}
        {activeTab === "create" && (
          <Card className="animate-fade-in">
            <CardContent className="p-6 space-y-6">
              {!parsedJob ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="raw-job">Paste raw job description here...</Label>
                    <Textarea
                      id="raw-job"
                      placeholder="Paste the complete job requisition text here. Our AI will extract all relevant details automatically..."
                      value={rawJobText}
                      onChange={(e) => setRawJobText(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                  <Button
                    variant="gradient"
                    onClick={handleParseJob}
                    disabled={isParsing || !rawJobText.trim()}
                    className="w-full"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        🔍 Parsing job details...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Parse with AI
                      </>
                    )}
                  </Button>
                </>
              ) : editableJob && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="job-name">Job Name</Label>
                      <Input
                        id="job-name"
                        value={editableJob.job_name}
                        onChange={(e) => setEditableJob({ ...editableJob, job_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facility">Facility</Label>
                      <Input
                        id="facility"
                        value={editableJob.facility_name}
                        onChange={(e) => setEditableJob({ ...editableJob, facility_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={editableJob.city}
                        onChange={(e) => setEditableJob({ ...editableJob, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={editableJob.state}
                        onChange={(e) => setEditableJob({ ...editableJob, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        value={editableJob.specialty}
                        onChange={(e) => setEditableJob({ ...editableJob, specialty: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bill-rate">Bill Rate ($/hr)</Label>
                      <Input
                        id="bill-rate"
                        type="number"
                        value={editableJob.bill_rate}
                        onChange={(e) => setEditableJob({ ...editableJob, bill_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={editableJob.start_date}
                        onChange={(e) => setEditableJob({ ...editableJob, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Schedule</Label>
                      <Input
                        id="schedule"
                        value={editableJob.schedule}
                        onChange={(e) => setEditableJob({ ...editableJob, schedule: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      value={editableJob.requirements}
                      onChange={(e) => setEditableJob({ ...editableJob, requirements: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setParsedJob(null);
                        setEditableJob(null);
                      }}
                      className="flex-1"
                    >
                      Start Over
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={handleSaveJob}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        "Save Job"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Selected Job Summary */}
        {selectedJob && (
          <Card className="border-primary/50 bg-primary/5 animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle>Selected Job</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {selectedJob.job_name || selectedJob.specialty || "Untitled Job"}
                </h3>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {selectedJob.facility_name || "No facility"} 
                  <span className="mx-1">|</span>
                  <MapPin className="h-4 w-4" />
                  {selectedJob.city && selectedJob.state ? `${selectedJob.city}, ${selectedJob.state}` : "No location"}
                </p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pay Rate</p>
                    <p className="font-semibold text-foreground">${calculatePayRate(selectedJob.bill_rate)}/hr</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-semibold text-foreground">{formatDate(selectedJob.start_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-semibold text-foreground">{selectedJob.schedule || "TBD"}</p>
                  </div>
                </div>
              </div>

              {selectedJob.requirements && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Key Requirements</p>
                  <p className="text-sm text-foreground">{selectedJob.requirements}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Link 
            to="/campaigns" 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleNext}
            disabled={!selectedJob}
          >
            Next: Find Candidates
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default CampaignBuilder;
