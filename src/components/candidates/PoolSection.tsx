import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CandidatePoolCard from "./CandidatePoolCard";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  city?: string;
  unified_score: string;
  match_strength: number;
  licenses: string[];
  licenses_count: number;
  enrichment_tier: string;
  enrichment_source?: string;
  has_personal_contact: boolean;
  needs_enrichment: boolean;
  personal_mobile?: string;
  personal_email?: string;
  work_email?: string;
  work_phone?: string;
  researched?: boolean;
  deep_researched?: boolean;
  verified_npi?: boolean;
  npi?: string;
  has_imlc?: boolean;
  is_enriched?: boolean;
  from_cache?: boolean;
  // Research fields
  credentials_summary?: string;
  professional_highlights?: string[];
  verified_specialty?: string;
  verified_licenses?: string[];
  match_concerns?: string[];
  match_reasons?: string[];
  icebreaker?: string;
  talking_points?: string[];
  research_summary?: string;
  research_confidence?: string;
  personalization_hook?: string;
  hook_type?: string;
}

interface PoolSectionProps {
  title: string;
  subtitle?: string;
  candidates: Candidate[];
  highlight?: 'green' | 'default';
  addedIds: Set<string>;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onAddAll: () => void;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onResearch: (candidate: Candidate) => void;
  onDeepResearch: (candidate: Candidate, forceRefresh?: boolean) => void;
  onEnrich: (candidate: Candidate) => void;
  researchingIds: Set<string>;
  deepResearchingIds: Set<string>;
  enrichingIds: Set<string>;
  jobState: string;
  job?: {
    specialty?: string;
    state?: string;
    payRate?: number;
  };
}

const PoolSection = ({ 
  title, 
  subtitle, 
  candidates, 
  highlight = 'default',
  addedIds,
  selectedIds,
  expandedIds,
  onAdd,
  onRemove,
  onAddAll,
  onToggleSelect,
  onToggleExpand,
  onResearch,
  onDeepResearch,
  onEnrich,
  researchingIds,
  deepResearchingIds,
  enrichingIds,
  jobState,
  job,
}: PoolSectionProps) => {
  if (candidates.length === 0) return null;
  
  const isLocal = highlight === 'green';
  
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 rounded-lg",
        isLocal 
          ? "bg-success/10 border border-success/20" 
          : "bg-muted/50 border border-border"
      )}>
        <div>
          <h3 className={cn(
            "font-semibold flex items-center gap-2",
            isLocal ? "text-success" : "text-foreground"
          )}>
            {isLocal && <MapPin className="h-4 w-4" />}
            {title} ({candidates.length})
          </h3>
          {subtitle && (
            <p className={cn(
              "text-xs mt-0.5",
              isLocal ? "text-success/70" : "text-muted-foreground"
            )}>
              {subtitle}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddAll}
          className={cn(
            isLocal 
              ? "border-success/30 text-success hover:bg-success/10" 
              : "border-primary/30 text-primary hover:bg-primary/10"
          )}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add All
        </Button>
      </div>
      
      {/* Candidate Cards */}
      <div className="space-y-2">
        {candidates.map(candidate => (
          <CandidatePoolCard 
            key={candidate.id}
            candidate={candidate}
            isLocal={isLocal}
            isAdded={addedIds.has(candidate.id)}
            isSelected={selectedIds.has(candidate.id)}
            isExpanded={expandedIds.has(candidate.id)}
            onAdd={() => onAdd(candidate.id)}
            onRemove={() => onRemove(candidate.id)}
            onToggleSelect={() => onToggleSelect(candidate.id)}
            onToggleExpand={() => onToggleExpand(candidate.id)}
            onResearch={() => onResearch(candidate)}
            onDeepResearch={(forceRefresh) => onDeepResearch(candidate, forceRefresh)}
            onEnrich={() => onEnrich(candidate)}
            isResearching={researchingIds.has(candidate.id)}
            isDeepResearching={deepResearchingIds.has(candidate.id)}
            isEnriching={enrichingIds.has(candidate.id)}
            jobState={jobState}
            job={job}
          />
        ))}
      </div>
    </div>
  );
};

export default PoolSection;
