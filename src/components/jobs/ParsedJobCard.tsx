import { useState, useRef, useEffect } from "react";
import { 
  MapPin, Calendar, Building2, Stethoscope, DollarSign, 
  Clock, FileCheck, CheckCircle2, Check, X 
} from "lucide-react";

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
  onUpdate?: (field: keyof ParsedJob, value: string | number) => void;
  readOnly?: boolean;
}

const ParsedJobCard = ({ job, onUpdate, readOnly = false }: ParsedJobCardProps) => {
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
              <EditableField
                value={job.specialty}
                onSave={(val) => onUpdate?.('specialty', val)}
                readOnly={readOnly}
                className="font-display text-xl font-bold text-primary-foreground"
                inputClassName="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
              />
            </div>
          </div>
          {!readOnly && (
            <span className="text-xs text-primary-foreground/60">
              Click any field to edit
            </span>
          )}
        </div>
      </div>

      {/* Content - 2 Column Grid */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <EditableDetailItem
            icon={<Stethoscope className="h-4 w-4" />}
            label="Specialty"
            value={job.specialty}
            onSave={(val) => onUpdate?.('specialty', val)}
            readOnly={readOnly}
          />
          <EditableDetailItem
            icon={<MapPin className="h-4 w-4" />}
            label="Location"
            value={job.location}
            onSave={(val) => onUpdate?.('location', val)}
            readOnly={readOnly}
          />
          <EditableDetailItem
            icon={<Building2 className="h-4 w-4" />}
            label="Facility"
            value={job.facility}
            onSave={(val) => onUpdate?.('facility', val)}
            readOnly={readOnly}
          />
          <EditableDetailItem
            icon={<Calendar className="h-4 w-4" />}
            label="Dates"
            value={job.dates}
            onSave={(val) => onUpdate?.('dates', val)}
            readOnly={readOnly}
          />
          
          {/* Bill Rate */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill Rate
              </p>
              <EditableField
                value={`$${job.billRate.toLocaleString()}/hr`}
                onSave={(val) => {
                  const num = parseFloat(val.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) onUpdate?.('billRate', num);
                }}
                readOnly={readOnly}
                className="font-semibold text-foreground"
              />
            </div>
          </div>

          {/* Pay Rate - Green */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-success">
                Pay Rate
              </p>
              <EditableField
                value={`$${job.payRate.toLocaleString()}/hr`}
                onSave={(val) => {
                  const num = parseFloat(val.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) onUpdate?.('payRate', num);
                }}
                readOnly={readOnly}
                className="font-semibold text-success"
              />
            </div>
          </div>

          {job.schedule && (
            <EditableDetailItem
              icon={<Clock className="h-4 w-4" />}
              label="Schedule"
              value={job.schedule}
              onSave={(val) => onUpdate?.('schedule', val)}
              readOnly={readOnly}
            />
          )}

          {job.requirements && (
            <EditableDetailItem
              icon={<FileCheck className="h-4 w-4" />}
              label="Requirements"
              value={job.requirements}
              onSave={(val) => onUpdate?.('requirements', val)}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  inputClassName?: string;
}

const EditableField = ({ value, onSave, readOnly, className = "", inputClassName = "" }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (readOnly) {
    return <p className={className}>{value}</p>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={`px-2 py-0.5 rounded border text-sm w-full min-w-0 ${inputClassName || 'bg-secondary border-border'}`}
        />
        <button
          onClick={handleSave}
          className="p-1 rounded hover:bg-success/20 text-success"
          type="button"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 rounded hover:bg-destructive/20 text-destructive"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <p 
      className={`${className} cursor-pointer hover:bg-secondary/50 px-1 -mx-1 rounded transition-colors`}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">Click to add</span>}
    </p>
  );
};

interface EditableDetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onSave: (value: string) => void;
  readOnly?: boolean;
}

const EditableDetailItem = ({ icon, label, value, onSave, readOnly }: EditableDetailItemProps) => (
  <div className="flex items-start gap-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <EditableField
        value={value}
        onSave={onSave}
        readOnly={readOnly}
        className="font-medium text-foreground"
      />
    </div>
  </div>
);

export default ParsedJobCard;
