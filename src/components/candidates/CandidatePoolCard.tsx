import { useState } from "react";
import { 
  MapPin, Plus, Check, ChevronDown, ChevronUp, Loader2, 
  Target, Shield, Phone, Mail, Search, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ResearchInsights } from "./ResearchInsights";

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
  source?: string;
}

interface CandidatePoolCardProps {
  candidate: Candidate;
  isLocal: boolean;
  isAdded: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onResearch: () => void;
  onDeepResearch: (forceRefresh?: boolean) => void;
  onEnrich: () => void;
  isResearching: boolean;
  isDeepResearching: boolean;
  isEnriching: boolean;
  jobState: string;
  job?: {
    specialty?: string;
    state?: string;
    payRate?: number;
  };
}

const ENRICHED_SOURCES = ['Whitepages', 'PDL', 'Apollo', 'Hunter', 'Clearbit', 'ZoomInfo'];

// Score badge configuration
const getScoreBadgeConfig = (score: string) => {
  switch (score) {
    case "A+":
      return { className: "bg-success text-success-foreground ring-2 ring-yellow-400" };
    case "A":
      return { className: "bg-success text-success-foreground" };
    case "A-":
    case "B+":
      return { className: "bg-blue-500 text-white" };
    case "B":
    case "B-":
      return { className: "bg-warning text-warning-foreground" };
    default:
      return { className: "bg-muted text-muted-foreground" };
  }
};

// Enrichment tier badge configuration
const getEnrichmentBadgeConfig = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "platinum":
      return { className: "bg-purple-500 text-white", icon: <Sparkles className="h-3 w-3 mr-1" />, label: "Platinum" };
    case "gold":
      return { className: "bg-yellow-500 text-yellow-900", icon: null, label: "Gold" };
    case "silver":
      return { className: "bg-gray-400 text-gray-900", icon: null, label: "Silver" };
    case "bronze":
      return { className: "bg-orange-600 text-white", icon: null, label: "Bronze" };
    default:
      return { className: "bg-muted text-muted-foreground", icon: null, label: tier || "Unknown" };
  }
};

const CandidatePoolCard = ({
  candidate,
  isLocal,
  isAdded,
  isSelected,
  isExpanded,
  onAdd,
  onRemove,
  onToggleSelect,
  onToggleExpand,
  onResearch,
  onDeepResearch,
  onEnrich,
  isResearching,
  isDeepResearching,
  isEnriching,
  jobState,
  job,
}: CandidatePoolCardProps) => {
  const scoreBadge = getScoreBadgeConfig(candidate.unified_score);
  const enrichmentBadge = getEnrichmentBadgeConfig(candidate.enrichment_tier);

  const isEnrichedPersonal = candidate.is_enriched || 
    (candidate.enrichment_source && ENRICHED_SOURCES.includes(candidate.enrichment_source));

  const isContactReady = candidate.personal_mobile || candidate.personal_email || 
    candidate.has_personal_contact || 
    ['platinum', 'gold'].includes(candidate.enrichment_tier?.toLowerCase() || '') ||
    isEnrichedPersonal;

  const needsEnrichment = candidate.needs_enrichment && !isEnrichedPersonal;

  const hasJobStateLicense = candidate.licenses?.some(l => 
    l.toUpperCase().includes(jobState.toUpperCase())
  );

  // Key indicators
  const indicators: { label: string; className: string }[] = [];
  
  if (hasJobStateLicense) {
    indicators.push({ 
      label: `${jobState} Licensed ✓`, 
      className: "bg-success/20 text-success border-success/30" 
    });
  } else if (candidate.has_imlc || candidate.licenses_count >= 10) {
    indicators.push({ 
      label: candidate.has_imlc ? "IMLC Eligible" : `${candidate.licenses_count} States`, 
      className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" 
    });
  }

  if (isContactReady) {
    indicators.push({ 
      label: "Contact Ready", 
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
    });
  }

  if (candidate.researched) {
    indicators.push({ 
      label: "Researched", 
      className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" 
    });
  }

  if (candidate.deep_researched) {
    indicators.push({ 
      label: "Deep", 
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30" 
    });
  }

  return (
    <div 
      className={cn(
        "rounded-xl border bg-card transition-all",
        isAdded && "border-success/40 bg-success/5",
        isLocal && !isAdded && "border-success/20",
        !isAdded && !isLocal && "border-border"
      )}
    >
      {/* Local Banner */}
      {isLocal && (
        <div className="bg-success/10 border-b border-success/20 px-4 py-2 rounded-t-xl">
          <div className="flex items-center gap-2 text-success text-sm font-medium">
            <MapPin className="h-4 w-4" />
            LOCAL CANDIDATE - In job state ({jobState})
          </div>
          <div className="text-success/70 text-xs mt-0.5">
            Faster credentialing • No relocation • Immediate start
          </div>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Candidate Info */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* Name Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="font-semibold text-foreground">
                {candidate.first_name} {candidate.last_name}
              </span>
              {candidate.verified_npi && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <Shield className="h-3 w-3 mr-1" /> NPI ✓
                </Badge>
              )}
            </div>
            
            {/* Specialty + Location */}
            <p className="text-sm text-muted-foreground">
              {candidate.specialty} • {candidate.city}, {candidate.state}
            </p>
            
            {/* Score + Progress Bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={cn("font-bold text-xs", scoreBadge.className)}>
                {candidate.unified_score}
              </Badge>
              <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                <Progress value={candidate.match_strength} className="h-2" />
                <span className="text-xs font-medium text-muted-foreground w-8">
                  {candidate.match_strength}%
                </span>
              </div>
              <Badge className={cn("text-xs flex items-center", enrichmentBadge.className)}>
                {enrichmentBadge.icon}
                {enrichmentBadge.label}
              </Badge>
            </div>
            
            {/* Key Indicators */}
            <div className="flex flex-wrap gap-1.5">
              {indicators.slice(0, 4).map((ind, i) => (
                <Badge key={i} variant="outline" className={cn("text-[10px] border", ind.className)}>
                  {ind.label}
                </Badge>
              ))}
            </div>
            
            {/* Needs Enrichment Banner */}
            {needsEnrichment && !isContactReady && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-warning flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  Missing personal contact
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-warning/30 text-warning hover:bg-warning/10 h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); onEnrich(); }}
                  disabled={isEnriching}
                >
                  {isEnriching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enrich Now - $0.20"}
                </Button>
              </div>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex flex-col gap-2 items-end shrink-0">
            {/* Add/Added Button */}
            {isAdded ? (
              <Button
                size="sm"
                variant="outline"
                className="bg-success/20 text-success border-success/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
              >
                <Check className="h-4 w-4 mr-1" />
                Added
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
            
            {/* Research Button */}
            {!candidate.researched && (
              <Button
                size="sm"
                variant="outline"
                className="text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10"
                onClick={(e) => { e.stopPropagation(); onResearch(); }}
                disabled={isResearching}
              >
                {isResearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-1" />
                    Research
                  </>
                )}
              </Button>
            )}
            
            {/* Deep Research Button */}
            {candidate.researched && !candidate.deep_researched && (
              <Button
                size="sm"
                variant="outline"
                className="text-purple-600 border-purple-500/30 hover:bg-purple-500/10"
                onClick={(e) => { e.stopPropagation(); onDeepResearch(false); }}
                disabled={isDeepResearching}
              >
                {isDeepResearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>🔮 Deep</>
                )}
              </Button>
            )}
            
            {/* Expand Toggle */}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="text-muted-foreground"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border animate-fade-in">
            {/* Contact Info */}
            {(candidate.personal_mobile || candidate.personal_email || candidate.work_phone || candidate.work_email) && (
              <div className="flex flex-wrap gap-4 mb-4">
                {candidate.personal_mobile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-success" />
                    <span className="text-foreground font-medium">{candidate.personal_mobile}</span>
                    <Badge className="bg-success/20 text-success text-[10px]">Personal</Badge>
                  </div>
                )}
                {candidate.personal_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-success" />
                    <span className="text-foreground">{candidate.personal_email}</span>
                    <Badge className="bg-success/20 text-success text-[10px]">Personal</Badge>
                  </div>
                )}
                {candidate.work_phone && !candidate.personal_mobile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-amber-500" />
                    <span className="text-foreground">{candidate.work_phone}</span>
                    <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">Work</Badge>
                  </div>
                )}
                {candidate.work_email && !candidate.personal_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-amber-500" />
                    <span className="text-foreground">{candidate.work_email}</span>
                    <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">Work</Badge>
                  </div>
                )}
              </div>
            )}
            
            {/* Licenses */}
            {candidate.licenses && candidate.licenses.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Licenses ({candidate.licenses_count || candidate.licenses.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(candidate.verified_licenses || candidate.licenses).slice(0, 15).map((license, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        license.toUpperCase() === jobState.toUpperCase() 
                          ? "bg-success/20 text-success border-success/40" 
                          : "bg-muted/50 text-muted-foreground border-border"
                      )}
                    >
                      {license}
                    </Badge>
                  ))}
                  {candidate.licenses.length > 15 && (
                    <Badge variant="outline" className="text-xs">
                      +{candidate.licenses.length - 15} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {/* Research Insights */}
            {(candidate.researched || candidate.deep_researched) && candidate.research_summary && (
              <ResearchInsights 
                researchSummary={candidate.research_summary}
                confidence={candidate.research_confidence as 'high' | 'medium' | 'low' | undefined}
              />
            )}
            
            {/* Research CTA */}
            {!candidate.researched && !candidate.deep_researched && (
              <div className="rounded-lg bg-muted/30 border border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Research Available</p>
                    <p className="text-xs text-muted-foreground">
                      Run NPI + AI research for personalized outreach
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isResearching}
                  onClick={(e) => { e.stopPropagation(); onResearch(); }}
                >
                  {isResearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-1" />
                      Research
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidatePoolCard;
