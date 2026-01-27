import { Link } from "react-router-dom";
import { MapPin, DollarSign, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Job {
  id: string;
  job_name: string | null;
  specialty: string | null;
  state: string | null;
  city: string | null;
  facility_name: string | null;
  status: string | null;
  pay_rate: number | null;
  candidate_count?: number;
}

interface DashboardJobCardProps {
  job: Job;
}

export function DashboardJobCard({ job }: DashboardJobCardProps) {
  const displayName = job.job_name || job.specialty || "Untitled Job";
  const location = [job.city, job.state].filter(Boolean).join(", ") || "Location TBD";
  
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    draft: "bg-muted text-muted-foreground border-muted",
    closed: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <Card className="group hover:border-primary/30 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
            <p className="text-sm text-muted-foreground truncate">{job.facility_name || "Facility TBD"}</p>
          </div>
          <Badge 
            variant="outline" 
            className={statusColors[job.status || "draft"]}
          >
            {job.status || "Draft"}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>{location}</span>
          </div>
          {job.pay_rate && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span>${job.pay_rate}/hr</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{job.candidate_count || 0} matched</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="h-7 text-xs group-hover:text-primary"
          >
            <Link to={`/candidates/matching?jobId=${job.id}`}>
              View Candidates
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
