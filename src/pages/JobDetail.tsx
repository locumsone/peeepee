import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Pencil, Users, Rocket, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Job {
  id: string;
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  specialty: string;
  schedule: string;
  start_date: string;
  end_date: string;
  requirements: string;
  bill_rate: number;
  pay_rate: number;
  status: string;
  is_urgent?: boolean;
  requisition_id?: string;
  client_contact?: string;
  client_email?: string;
}

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setJob(data);
      } catch (err) {
        console.error("Error fetching job:", err);
        toast({
          title: "Error",
          description: "Failed to load job details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  const copyId = async () => {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    toast({ title: "Copied!", description: "Job ID copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-success text-success-foreground",
      on_hold: "bg-warning text-warning-foreground",
      filled: "bg-blue-500 text-white",
      closed: "bg-muted text-muted-foreground",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  // Calculate pay breakdown based on bill_rate
  const billRate = job?.bill_rate || 0;
  const payRate = billRate * 0.73;
  const malpractice = payRate * 0.10;
  const margin = billRate - (payRate * 1.10);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl text-center py-20">
          <h1 className="text-2xl font-bold text-foreground mb-4">Job Not Found</h1>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>

        {/* Main Job Card */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border bg-secondary/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground font-display">
                  {job.job_name || "Untitled Job"}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {job.requisition_id && (
                    <Badge variant="outline" className="font-mono text-xs">
                      REQ #{job.requisition_id}
                    </Badge>
                  )}
                  <Badge className={cn("capitalize", getStatusBadge(job.status))}>
                    {job.status?.replace("_", " ") || "draft"}
                  </Badge>
                  {job.is_urgent && (
                    <Badge className="bg-destructive text-destructive-foreground">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      URGENT
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="default" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/candidates/search?jobId=${id}`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Find Candidates
                </Button>
                <Button 
                  variant="default"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => navigate(`/campaign/tiers?jobId=${id}`)}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </div>
          </div>

          {/* Job Details Table */}
          <div className="p-6">
            <table className="w-full text-sm font-mono">
              <tbody className="divide-y divide-border/50">
                <TableRow 
                  label="Supabase ID" 
                  value={
                    <button
                      onClick={copyId}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <span className="text-xs">{id}</span>
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  }
                />
                <TableRow 
                  label="Facility" 
                  value={`${job.facility_name || "—"}${job.city ? `, ${job.city}` : ""}${job.state ? `, ${job.state}` : ""}`}
                />
                <TableRow label="Specialty" value={job.specialty || "—"} />
                <TableRow label="Schedule" value={job.schedule || "—"} />
                <TableRow label="Start Date" value={formatDate(job.start_date)} />
                {job.end_date && (
                  <TableRow label="End Date" value={formatDate(job.end_date)} />
                )}
                <TableRow 
                  label="Requirements" 
                  value={job.requirements || "No specific requirements listed"}
                  multiline
                />
                {job.client_contact && (
                  <TableRow label="Client Contact" value={job.client_contact} />
                )}
                {job.client_email && (
                  <TableRow label="Client Email" value={job.client_email} />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pay Breakdown Card */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-success/10">
            <h2 className="text-lg font-semibold text-success flex items-center gap-2">
              💰 Pay Breakdown
            </h2>
          </div>
          <div className="p-6">
            <table className="w-full text-sm font-mono">
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="py-3 text-muted-foreground w-40">Bill Rate</td>
                  <td className="py-3 text-foreground font-medium">
                    ${billRate.toFixed(0)}/hr
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-muted-foreground">Pay Rate</td>
                  <td className="py-3 text-success font-semibold">
                    ${payRate.toFixed(0)}/hr <span className="text-muted-foreground font-normal">(73%)</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-muted-foreground">Malpractice</td>
                  <td className="py-3 text-foreground">
                    ${malpractice.toFixed(0)}/hr <span className="text-muted-foreground">(10%)</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-muted-foreground">Margin</td>
                  <td className="py-3 text-foreground">
                    ${margin.toFixed(0)}/hr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Button */}
        <div className="flex items-center justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={() => navigate(`/edit-job/${id}`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Job
          </Button>
        </div>
      </div>
    </Layout>
  );
};

interface TableRowProps {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}

const TableRow = ({ label, value, multiline }: TableRowProps) => (
  <tr>
    <td className="py-3 text-muted-foreground w-40 align-top">{label}</td>
    <td className={cn("py-3 text-foreground", multiline && "whitespace-pre-wrap")}>
      {value}
    </td>
  </tr>
);

export default JobDetail;
