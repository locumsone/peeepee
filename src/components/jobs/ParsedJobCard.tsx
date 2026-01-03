import { MapPin, Calendar, Building2, Stethoscope, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ParsedJob {
  id?: string;
  specialty: string;
  location: string;
  facility: string;
  dates: string;
  billRate: number;
  payRate: number;
}

interface ParsedJobCardProps {
  job: ParsedJob;
  onFindCandidates: () => void;
}

const ParsedJobCard = ({ job, onFindCandidates }: ParsedJobCardProps) => {
  return (
    <div className="w-full rounded-2xl bg-card gradient-card shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="gradient-primary px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20 backdrop-blur-sm">
            <Stethoscope className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-primary-foreground">
              {job.specialty}
            </h3>
            <p className="text-sm text-primary-foreground/80">
              Parsed Job Opportunity
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            icon={<Building2 className="h-4 w-4" />}
            label="Facility"
            value={job.facility}
          />
          <DetailItem
            icon={<MapPin className="h-4 w-4" />}
            label="Location"
            value={job.location}
          />
          <DetailItem
            icon={<Calendar className="h-4 w-4" />}
            label="Dates"
            value={job.dates}
          />
        </div>

        {/* Rates */}
        <div className="flex flex-wrap gap-4 pt-2">
          <div className="flex-1 min-w-[140px] rounded-xl bg-secondary p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Bill Rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${job.billRate.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/hr</span>
            </p>
          </div>
          <div className="flex-1 min-w-[140px] rounded-xl bg-success/10 border border-success/20 p-4">
            <div className="flex items-center gap-2 text-success mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Pay Rate</span>
            </div>
            <p className="text-2xl font-bold text-success">
              ${job.payRate.toLocaleString()}<span className="text-sm font-normal text-success/70">/hr</span>
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="pt-4">
          <Button 
            variant="gradient" 
            size="lg" 
            className="w-full"
            onClick={onFindCandidates}
          >
            Find Matching Candidates
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const DetailItem = ({ icon, label, value }: DetailItemProps) => (
  <div className="flex items-start gap-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  </div>
);

export default ParsedJobCard;
