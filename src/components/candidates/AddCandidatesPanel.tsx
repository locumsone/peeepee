import { useState, useMemo } from "react";
import { 
  MapPin, Users, Phone, Search, Plus, X, Check, Loader2, 
  Shield, Sparkles, Filter, CheckCircle2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CandidateResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  specialty: string | null;
  state: string | null;
  city: string | null;
  licenses: string[] | null;
  enrichment_tier: string | null;
  personal_mobile: string | null;
  personal_email: string | null;
  phone: string | null;
  email: string | null;
  npi: string | null;
}

interface TransformedCandidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  city: string;
  licenses: string[];
  licenses_count: number;
  enrichment_tier: string;
  has_personal_contact: boolean;
  personal_mobile?: string;
  personal_email?: string;
  unified_score: string;
  match_strength: number;
  score_reason: string;
  icebreaker: string;
  talking_points: string[];
  needs_enrichment: boolean;
  is_local?: boolean;
  source?: string;
}

interface AddCandidatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobState: string;
  specialty: string;
  existingCandidateIds: Set<string>;
  onAddCandidates: (candidates: TransformedCandidate[]) => void;
}

interface Filters {
  local: boolean;
  tenPlusLicenses: boolean;
  fivePlusLicenses: boolean;
  contactReady: boolean;
  needsEnrichment: boolean;
  excludeSelected: boolean;
}

const AddCandidatesPanel = ({
  isOpen,
  onClose,
  jobId,
  jobState,
  specialty,
  existingCandidateIds,
  onAddCandidates,
}: AddCandidatesPanelProps) => {
  const [filters, setFilters] = useState<Filters>({
    local: false,
    tenPlusLicenses: false,
    fivePlusLicenses: false,
    contactReady: false,
    needsEnrichment: false,
    excludeSelected: true,
  });
  const [nameSearch, setNameSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const toggleFilter = (key: keyof Filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    setSelectedResultIds(new Set());

    try {
      // Build dynamic query
      let query = supabase
        .from("candidates")
        .select(`
          id, first_name, last_name, specialty, state, city,
          licenses, enrichment_tier, personal_mobile, personal_email,
          phone, email, npi
        `)
        .limit(100);

      // Specialty filter (if provided)
      if (specialty) {
        query = query.ilike("specialty", `%${specialty}%`);
      }

      // Apply filters
      if (filters.local && jobState) {
        query = query.eq("state", jobState);
      }

      if (filters.contactReady) {
        query = query.or("personal_mobile.neq.null,personal_email.neq.null");
      }

      if (filters.needsEnrichment) {
        query = query.is("personal_mobile", null).is("personal_email", null);
      }

      // Name search
      if (nameSearch.trim()) {
        const search = nameSearch.trim();
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,npi.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredResults = data || [];

      // Client-side filtering for license counts (Supabase doesn't support array_length in JS client easily)
      if (filters.tenPlusLicenses) {
        filteredResults = filteredResults.filter(c => (c.licenses?.length || 0) >= 10);
      } else if (filters.fivePlusLicenses) {
        filteredResults = filteredResults.filter(c => (c.licenses?.length || 0) >= 5);
      }

      // Exclude already selected candidates
      if (filters.excludeSelected && existingCandidateIds.size > 0) {
        filteredResults = filteredResults.filter(c => !existingCandidateIds.has(c.id));
      }

      setResults(filteredResults);
      
      if (filteredResults.length === 0) {
        toast.info("No candidates found matching your criteria");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Failed to search candidates");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleResultSelection = (id: string) => {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllResults = () => {
    setSelectedResultIds(new Set(results.map(r => r.id)));
  };

  const clearSelection = () => {
    setSelectedResultIds(new Set());
  };

  // Calculate match score for added candidates
  const calculateMatchStrength = (candidate: CandidateResult): number => {
    let score = 70; // Base score
    
    const isLocal = candidate.state === jobState;
    const licensesCount = candidate.licenses?.length || 0;
    const hasContact = !!(candidate.personal_mobile || candidate.personal_email);
    const hasJobStateLicense = candidate.licenses?.some(l => 
      l.toUpperCase().includes(jobState?.toUpperCase() || '')
    );

    if (isLocal) score += 15;
    if (hasJobStateLicense) score += 10;
    if (licensesCount >= 10) score += 8;
    else if (licensesCount >= 5) score += 4;
    if (hasContact) score += 5;
    if (candidate.enrichment_tier?.toLowerCase() === 'platinum') score += 2;

    return Math.min(score, 100);
  };

  const getUnifiedScore = (strength: number): string => {
    if (strength >= 95) return "A+";
    if (strength >= 90) return "A";
    if (strength >= 85) return "A-";
    if (strength >= 80) return "B+";
    if (strength >= 75) return "B";
    if (strength >= 70) return "B-";
    return "C";
  };

  const handleAddSelected = () => {
    const selectedCandidates = results
      .filter(r => selectedResultIds.has(r.id))
      .map((c): TransformedCandidate => {
        const matchStrength = calculateMatchStrength(c);
        return {
          id: c.id,
          first_name: c.first_name || "",
          last_name: c.last_name || "",
          specialty: c.specialty || "",
          state: c.state || "",
          city: c.city || "",
          licenses: c.licenses || [],
          licenses_count: c.licenses?.length || 0,
          enrichment_tier: c.enrichment_tier || "Unknown",
          has_personal_contact: !!(c.personal_mobile || c.personal_email),
          personal_mobile: c.personal_mobile || undefined,
          personal_email: c.personal_email || undefined,
          unified_score: getUnifiedScore(matchStrength),
          match_strength: matchStrength,
          score_reason: `Added via search${c.state === jobState ? ' • Local candidate' : ''}`,
          icebreaker: "",
          talking_points: [],
          needs_enrichment: !(c.personal_mobile || c.personal_email),
          is_local: c.state === jobState,
          source: "manual_add",
        };
      });

    onAddCandidates(selectedCandidates);
    setResults([]);
    setSelectedResultIds(new Set());
    setHasSearched(false);
    setNameSearch("");
    setFilters({
      local: false,
      tenPlusLicenses: false,
      fivePlusLicenses: false,
      contactReady: false,
      needsEnrichment: false,
      excludeSelected: true,
    });
  };

  const alreadyInListCount = useMemo(() => {
    return results.filter(r => existingCandidateIds.has(r.id)).length;
  }, [results, existingCandidateIds]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add More Candidates
          </SheetTitle>
          <SheetDescription>
            Search for additional candidates to add to your campaign
          </SheetDescription>
        </SheetHeader>

        {/* Selection Preserved Banner */}
        {existingCandidateIds.size > 0 && (
          <div className="mx-6 mt-4 bg-success/10 border border-success/30 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <span className="text-sm text-success">
              Your {existingCandidateIds.size} selected candidates are preserved. 
              New candidates will be merged with your selection.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Filters Section */}
          <div className="px-6 py-4 space-y-4 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-4 w-4" />
              Quick Filters
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FilterChip
                active={filters.local}
                onClick={() => toggleFilter("local")}
                icon={<MapPin className="h-3.5 w-3.5" />}
                label={`Local (${jobState})`}
                description="In job state"
              />
              <FilterChip
                active={filters.tenPlusLicenses}
                onClick={() => toggleFilter("tenPlusLicenses")}
                icon={<Shield className="h-3.5 w-3.5" />}
                label="10+ Licenses"
                description="Multi-state travelers"
              />
              <FilterChip
                active={filters.contactReady}
                onClick={() => toggleFilter("contactReady")}
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Contact Ready"
                description="Has personal info"
              />
              <FilterChip
                active={filters.needsEnrichment}
                onClick={() => toggleFilter("needsEnrichment")}
                icon={<Search className="h-3.5 w-3.5" />}
                label="Needs Enrichment"
                description="Missing contact"
              />
            </div>

            {/* Name/NPI Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or NPI..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Exclude Already Selected Toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="excludeSelected"
                checked={filters.excludeSelected}
                onCheckedChange={() => toggleFilter("excludeSelected")}
              />
              <label 
                htmlFor="excludeSelected" 
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Exclude already selected candidates
              </label>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {hasSearched && (
              <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Results ({results.length})
                  </span>
                  {alreadyInListCount > 0 && !filters.excludeSelected && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {alreadyInListCount} already in list
                    </Badge>
                  )}
                </div>
                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllResults}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    {selectedResultIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="text-xs text-muted-foreground"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="px-6 py-2 space-y-2">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Searching candidates...</p>
                  </div>
                ) : results.length === 0 && hasSearched ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Users className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No candidates found</p>
                    <p className="text-xs text-muted-foreground/70">Try adjusting your filters</p>
                  </div>
                ) : !hasSearched ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Search className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Select filters and click Search</p>
                  </div>
                ) : (
                  results.map((candidate) => {
                    const isSelected = selectedResultIds.has(candidate.id);
                    const isInList = existingCandidateIds.has(candidate.id);
                    const hasContact = !!(candidate.personal_mobile || candidate.personal_email);
                    const isLocal = candidate.state === jobState;
                    const licensesCount = candidate.licenses?.length || 0;
                    const matchStrength = calculateMatchStrength(candidate);

                    return (
                      <div
                        key={candidate.id}
                        className={cn(
                          "p-3 rounded-lg border transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : isInList
                              ? "border-muted bg-muted/30 opacity-60"
                              : "border-border bg-card hover:border-primary/50"
                        )}
                        onClick={() => !isInList && toggleResultSelection(candidate.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isSelected}
                              disabled={isInList}
                              onCheckedChange={() => toggleResultSelection(candidate.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {candidate.first_name} {candidate.last_name}
                              </span>
                              {isInList && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Already in list
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {candidate.specialty} • {candidate.city}, {candidate.state}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {isLocal && (
                                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  Local
                                </Badge>
                              )}
                              {licensesCount >= 10 && (
                                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-500 border-purple-500/30">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {licensesCount} Licenses
                                </Badge>
                              )}
                              {hasContact && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                                  <Check className="h-3 w-3 mr-1" />
                                  Contact Ready
                                </Badge>
                              )}
                              {!hasContact && (
                                <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                                  Needs Enrichment
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Progress value={matchStrength} className="h-1.5 w-12" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {matchStrength}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer with Add Button */}
        {selectedResultIds.size > 0 && (
          <div className="px-6 py-4 border-t border-border bg-card">
            <Button
              className="w-full"
              variant="gradient"
              size="lg"
              onClick={handleAddSelected}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {selectedResultIds.size} Candidate{selectedResultIds.size !== 1 ? "s" : ""} to Campaign
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// Filter Chip Component
interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

const FilterChip = ({ active, onClick, icon, label, description }: FilterChipProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-start gap-2 p-2.5 rounded-lg border-2 transition-all text-left",
      active
        ? "border-primary bg-primary/10"
        : "border-border bg-card hover:border-primary/40"
    )}
  >
    <div className={cn(
      "mt-0.5",
      active ? "text-primary" : "text-muted-foreground"
    )}>
      {icon}
    </div>
    <div>
      <span className={cn(
        "text-xs font-medium",
        active ? "text-primary" : "text-foreground"
      )}>
        {label}
      </span>
      {description && (
        <p className="text-[10px] text-muted-foreground">{description}</p>
      )}
    </div>
  </button>
);

export default AddCandidatesPanel;
