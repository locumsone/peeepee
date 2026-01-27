import { ArrowLeft, Copy, Check, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  pay_rate?: number;
  bill_rate?: number;
  status: string;
  is_urgent?: boolean;
  requisition_id?: string;
}

interface JobDetailHeaderProps {
  job: Job;
}

export const JobDetailHeader = ({ job }: JobDetailHeaderProps) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyReqId = async () => {
    if (!job.requisition_id) return;
    await navigator.clipboard.writeText(job.requisition_id);
    setCopied(true);
    toast({ title: "Copied!", description: "Requisition ID copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
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

  const payRate = job.pay_rate || (job.bill_rate ? job.bill_rate * 0.73 : 0);

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Jobs
      </Button>

      {/* Header Card */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-secondary/50 to-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              {/* Job Title */}
              <h1 className="text-2xl font-bold text-foreground font-display">
                {job.job_name || "Untitled Job"}
              </h1>
              
              {/* Location & Pay */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{job.facility_name}</span>
                <span>•</span>
                <span>{job.city}, {job.state}</span>
                <span>•</span>
                <span className="text-success font-semibold text-base">${payRate.toFixed(0)}/hr</span>
              </div>
              
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {job.requisition_id && (
                  <Badge 
                    variant="outline" 
                    className="font-mono text-xs cursor-pointer hover:bg-muted transition-colors"
                    onClick={copyReqId}
                  >
                    REQ #{job.requisition_id}
                    {copied ? (
                      <Check className="h-3 w-3 ml-1 text-success" />
                    ) : (
                      <Copy className="h-3 w-3 ml-1 opacity-50" />
                    )}
                  </Badge>
                )}
                <Badge className={cn("capitalize", getStatusBadge(job.status))}>
                  {job.status?.replace("_", " ") || "draft"}
                </Badge>
                {job.is_urgent && (
                  <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    URGENT
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailHeader;
