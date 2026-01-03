import { 
  MapPin, Calendar, Building2, Stethoscope, DollarSign, 
  Clock, FileCheck, Pencil, CheckCircle2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ParsedJob {
  id?: string;
  specialty: string;
  location: string;
  facility: string;
  dates: string;
  billRate: number;
  payRate: number;
  schedule?: string;
  requirements?: string;
}

interface ParsedJobCardProps {
  job: ParsedJob;
  onEdit: () => void;
}

const ParsedJobCard = ({ job, onEdit }: ParsedJobCardProps) => {
  return (
    <div className="w-full rounded-2xl bg-card shadow-card overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="gradient-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20 backdrop-blur-sm">
              <Stethoscope className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs font-medium text-primary-foreground/80 uppercase tracking-wide">
                  Parsed Job
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-primary-foreground">
                {job.specialty}
              </h3>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onEdit}
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Content - 2 Column Grid */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            icon={<Stethoscope className="h-4 w-4" />}
            label="Specialty"
            value={job.specialty}
          />
          <DetailItem
            icon={<MapPin className="h-4 w-4" />}
            label="Location"
            value={job.location}
          />
          <DetailItem
            icon={<Building2 className="h-4 w-4" />}
            label="Facility"
            value={job.facility}
          />
          <DetailItem
            icon={<Calendar className="h-4 w-4" />}
            label="Dates"
            value={job.dates}
          />
          
          {/* Bill Rate */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill Rate
              </p>
              <p className="font-semibold text-foreground">
                ${job.billRate.toLocaleString()}/hr
              </p>
            </div>
          </div>

          {/* Pay Rate - Green */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-success">
                Pay Rate
              </p>
              <p className="font-semibold text-success">
                ${job.payRate.toLocaleString()}/hr
              </p>
            </div>
          </div>

          {job.schedule && (
            <DetailItem
              icon={<Clock className="h-4 w-4" />}
              label="Schedule"
              value={job.schedule}
            />
          )}

          {job.requirements && (
            <DetailItem
              icon={<FileCheck className="h-4 w-4" />}
              label="Requirements"
              value={job.requirements}
            />
          )}
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
