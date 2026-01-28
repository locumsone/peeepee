import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Search, Building2, MapPin, DollarSign, ArrowRight, ArrowLeft,
  Loader2, CheckCircle2, Flame, Star, ClipboardList, ChevronDown,
  ChevronUp, AlertTriangle, Check
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCampaignDraft } from "@/hooks/useCampaignDraft";
import type { SelectedCandidate } from "@/components/campaign-review/types";

interface Job {
  id: string;
  job_name: string | null;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  bill_rate: number | null;
}

interface MatchedCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  licenses: string[] | null;
  phone: string | null;
  email: string | null;
  personal_mobile: string | null;
  personal_email: string | null;
  match_score: number;
  match_reasons: string[];
  tier: number;
  // Research data that should persist
  icebreaker?: string;
  talking_points?: string[];
}

const WIZARD_STEPS = [
  { number: 1, label: "Job", completed: true },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Channels" },
  { number: 4, label: "Review" },
];

const CampaignCandidates = () => {
  const navigate = useNavigate();
  
  // Use unified draft persistence
  const { 
    job: draftJob, 
    candidates: draftCandidates,
    updateCandidates,
    lastSaved,
    isDirty,
    saveDraft
  } = useCampaignDraft();
  
  const [job, setJob] = useState<Job | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Collapsible states - C-tier collapsed by default
  const [aTierOpen, setATierOpen] = useState(true);
  const [bTierOpen, setBTierOpen] = useState(true);
  const [cTierOpen, setCTierOpen] = useState(false);
  const [showAllTiers, setShowAllTiers] = useState(false);
  
  // Enrichment loading state
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // Load job from draft or sessionStorage
  useEffect(() => {
    // First try draft job
    if (draftJob) {
      setJob(draftJob as Job);
      return;
    }
    
    // Fallback to sessionStorage
    const jobId = sessionStorage.getItem("campaign_job_id");
    const storedJob = sessionStorage.getItem("campaign_job");
    
    if (!jobId || !storedJob) {
      navigate("/campaigns/new");
      return;
    }
    
    setJob(JSON.parse(storedJob));
  }, [navigate, draftJob]);

  // Restore candidates from draft on mount
  useEffect(() => {
    if (draftCandidates && draftCandidates.length > 0 && candidates.length === 0) {
      // Convert draft candidates back to MatchedCandidate format
      const restoredCandidates: MatchedCandidate[] = draftCandidates.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        specialty: c.specialty || null,
        city: c.city || null,
        state: c.state || null,
        licenses: null,
        phone: c.phone || null,
        email: c.email || null,
        personal_mobile: c.personal_mobile || null,
        personal_email: c.personal_email || null,
        match_score: parseInt(c.unified_score || "0") || 0,
        match_reasons: [],
        tier: c.tier || 3,
        icebreaker: c.icebreaker,
        talking_points: c.talking_points,
      }));
      
      setCandidates(restoredCandidates);
      setSelectedIds(new Set(restoredCandidates.map(c => c.id)));
      setHasSearched(true);
      console.log("[CampaignCandidates] Restored", restoredCandidates.length, "candidates from draft");
    }
  }, [draftCandidates]);

  // Auto-save candidates to draft whenever selection changes
  const syncCandidatesToDraft = useCallback((
    allCandidates: MatchedCandidate[], 
    selected: Set<string>
  ) => {
    const selectedCandidates = allCandidates.filter(c => selected.has(c.id));
    
    // Convert to SelectedCandidate format for draft storage
    const draftFormat: SelectedCandidate[] = selectedCandidates.map(c => ({
      id: c.id,
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      email: c.email || undefined,
      phone: c.phone || undefined,
      personal_email: c.personal_email || undefined,
      personal_mobile: c.personal_mobile || undefined,
      specialty: c.specialty || undefined,
      city: c.city || undefined,
      state: c.state || undefined,
      tier: c.tier,
      unified_score: String(c.match_score || 0),
      icebreaker: c.icebreaker,
      talking_points: c.talking_points,
    }));
    
    updateCandidates(draftFormat);
  }, [updateCandidates]);

  // Save before component unmounts (navigation away)
  useEffect(() => {
    return () => {
      // Force sync on unmount
      if (candidates.length > 0) {
        saveDraft();
      }
    };
  }, [candidates, saveDraft]);

  const findCandidates = async () => {
    if (!job) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/ai-candidate-matcher",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NTA3NDIsImV4cCI6MjA1MDMyNjc0Mn0.5R1H_6tsnp27PN5qYNE-4VdRT1H8kqH-NXQMJQL8sxg",
          },
          body: JSON.stringify({ job_id: job.id, limit: 25 }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to find candidates");
      }

      const data = await response.json();
      const matchedCandidates: MatchedCandidate[] = data.candidates || data || [];
      
      setCandidates(matchedCandidates);
      setHasSearched(true);
      
      // Auto-select A-tier and B-tier candidates only (C-tier unchecked by default)
      const autoSelected = new Set<string>();
      matchedCandidates.forEach(c => {
        if (c.tier === 1 || c.tier === 2) {
          autoSelected.add(c.id);
        }
      });
      setSelectedIds(autoSelected);
      
      // Auto-save to draft
      syncCandidatesToDraft(matchedCandidates, autoSelected);
      
      // Ensure C-tier is collapsed by default
      setCTierOpen(false);
      
      toast.success(`Found ${matchedCandidates.length} matching candidates!`);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to find candidates. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Auto-save on every toggle
      syncCandidatesToDraft(candidates, next);
      return next;
    });
  };

  const selectAllAB = () => {
    const abIds = candidates
      .filter(c => c.tier === 1 || c.tier === 2)
      .map(c => c.id);
    const newSet = new Set(abIds);
    setSelectedIds(newSet);
    syncCandidatesToDraft(candidates, newSet);
  };

  const deselectAll = () => {
    const emptySet = new Set<string>();
    setSelectedIds(emptySet);
    syncCandidatesToDraft(candidates, emptySet);
  };

  // Toggle show all tiers
  const handleShowAllTiers = (checked: boolean) => {
    setShowAllTiers(checked);
    if (checked) {
      setCTierOpen(true);
    } else {
      setCTierOpen(false);
    }
  };

  // Enrich a candidate
  const enrichCandidate = async (candidate: MatchedCandidate) => {
    setEnrichingIds(prev => new Set(prev).add(candidate.id));
    
    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/enrich-contact",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NTA3NDIsImV4cCI6MjA1MDMyNjc0Mn0.5R1H_6tsnp27PN5qYNE-4VdRT1H8kqH-NXQMJQL8sxg",
          },
          body: JSON.stringify({
            candidate_id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            city: candidate.city,
            state: candidate.state,
            specialty: candidate.specialty,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Enrichment failed");
      }

      const data = await response.json();
      const foundPhone = data.phone || data.personal_mobile;
      const foundEmail = data.email || data.personal_email;

      if (foundPhone || foundEmail) {
        // Update the candidate in state and sync to draft
        setCandidates(prev => {
          const updated = prev.map(c =>
            c.id === candidate.id
              ? {
                  ...c,
                  phone: data.phone || c.phone,
                  personal_mobile: data.personal_mobile || c.personal_mobile,
                  email: data.email || c.email,
                  personal_email: data.personal_email || c.personal_email,
                }
              : c
          );
          // Sync enriched data to draft
          syncCandidatesToDraft(updated, selectedIds);
          return updated;
        });
        toast.success(`✅ Found: ${foundPhone || "—"} / ${foundEmail || "—"}`);
      } else {
        toast.warning("⚠️ No contact info found");
      }
    } catch (error) {
      console.error("Enrichment error:", error);
      toast.error("Failed to enrich contact");
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(candidate.id);
        return next;
      });
    }
  };

  const handleNext = () => {
    // Final save before navigation
    syncCandidatesToDraft(candidates, selectedIds);
    saveDraft();
    
    const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
    // Save all required data to sessionStorage - sync ALL keys the wizard expects
    sessionStorage.setItem("campaign_candidate_ids", JSON.stringify(Array.from(selectedIds)));
    sessionStorage.setItem("campaign_candidates", JSON.stringify(selectedCandidates));
    sessionStorage.setItem("selectedCandidates", JSON.stringify(selectedCandidates));
    if (job) {
      // Save in BOTH formats for compatibility across wizard steps
      sessionStorage.setItem("job", JSON.stringify(job));
      sessionStorage.setItem("campaign_job", JSON.stringify(job));
      sessionStorage.setItem("campaign_job_id", job.id);
    }
    navigate("/campaigns/new/channels");
  };

  // Group candidates by tier
  const aTier = candidates.filter(c => c.tier === 1);
  const bTier = candidates.filter(c => c.tier === 2);
  const cTier = candidates.filter(c => c.tier === 3 || c.tier === 4 || !c.tier);

  // Calculate selection stats
  const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
  const readyCount = selectedCandidates.filter(c => hasContact(c)).length;
  const needsEnrichmentCount = selectedCandidates.length - readyCount;

  const calculatePayRate = (billRate: number | null) => {
    if (!billRate) return 0;
    return Math.round(billRate * 0.73);
  };

  return (
    <Layout showSteps={false} lastSaved={lastSaved} isDirty={isDirty}>
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        {/* Step Indicator */}
        <div className="w-full py-6">
          <div className="flex items-center justify-center">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all duration-300",
                      step.completed
                        ? "gradient-primary border-transparent text-primary-foreground shadow-md"
                        : step.number === 2
                        ? "gradient-primary border-transparent text-primary-foreground shadow-glow"
                        : "border-muted bg-muted text-muted-foreground"
                    )}
                  >
                    {step.completed ? <Check className="h-5 w-5" /> : step.number}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium transition-colors duration-300",
                      step.number <= 2 ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 w-12 sm:w-20 md:w-32 rounded-full transition-all duration-500",
                      step.completed ? "gradient-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Job Summary Card */}
        {job && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {job.job_name || job.specialty || "Untitled Job"}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      {job.facility_name || "No facility"}
                      <span className="mx-1">|</span>
                      <MapPin className="h-3.5 w-3.5" />
                      {job.city && job.state ? `${job.city}, ${job.state}` : "No location"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary font-semibold">
                  <DollarSign className="h-4 w-4" />
                  ${calculatePayRate(job.bill_rate)}/hr
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Find Candidates Button */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Button
              variant="gradient"
              size="xl"
              onClick={findCandidates}
              disabled={isSearching}
              className="min-w-[280px]"
            >
            {isSearching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Finding matching candidates...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Find Matching Candidates
              </>
            )}
            </Button>
            {isSearching && (
              <p className="text-muted-foreground text-sm animate-pulse">
                🤖 AI is analyzing candidate profiles against job requirements...
              </p>
            )}
          </div>
        )}

        {/* Results Display */}
        {hasSearched && candidates.length > 0 && (
          <>
            {/* Summary Row */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                Found {candidates.length} candidates
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/30">
                  🔥 A-Tier: {aTier.length}
                </Badge>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  ⭐ B-Tier: {bTier.length}
                </Badge>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  📋 C-Tier: {cTier.length}
                </Badge>
              </div>
            </div>

            {/* Show All Tiers Toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="showAllTiers"
                checked={showAllTiers}
                onCheckedChange={handleShowAllTiers}
              />
              <label htmlFor="showAllTiers" className="text-sm text-muted-foreground cursor-pointer">
                ☑️ Show all tiers
              </label>
            </div>

            {/* A-Tier Section */}
            {aTier.length > 0 && (
              <TierSection
                title="A-Tier (Perfect Match)"
                icon={<Flame className="h-5 w-5" />}
                candidates={aTier}
                selectedIds={selectedIds}
                onToggle={toggleCandidate}
                isOpen={aTierOpen}
                onOpenChange={setATierOpen}
                variant="green"
                onEnrich={enrichCandidate}
                enrichingIds={enrichingIds}
              />
            )}

            {/* B-Tier Section */}
            {bTier.length > 0 && (
              <TierSection
                title="B-Tier (Strong Match)"
                icon={<Star className="h-5 w-5" />}
                candidates={bTier}
                selectedIds={selectedIds}
                onToggle={toggleCandidate}
                isOpen={bTierOpen}
                onOpenChange={setBTierOpen}
                variant="blue"
                onEnrich={enrichCandidate}
                enrichingIds={enrichingIds}
              />
            )}

            {/* C-Tier Section */}
            {cTier.length > 0 && (
              <TierSection
                title={cTierOpen ? "C-Tier (Consider)" : `📋 C-Tier (${cTier.length} candidates) - Click to expand`}
                icon={<ClipboardList className="h-5 w-5" />}
                candidates={cTier}
                selectedIds={selectedIds}
                onToggle={toggleCandidate}
                isOpen={cTierOpen}
                onOpenChange={setCTierOpen}
                variant="gray"
                onEnrich={enrichCandidate}
                enrichingIds={enrichingIds}
              />
            )}
          </>
        )}

        {hasSearched && candidates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No matching candidates found. Try adjusting your job criteria.</p>
          </div>
        )}

        {/* Selection Summary Bar (Sticky) */}
        {hasSearched && candidates.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-foreground">
                  {selectedIds.size} candidates selected
                </span>
                <span className="text-sm text-muted-foreground">
                  ({readyCount} ready, {needsEnrichmentCount} need enrichment)
                </span>
                {needsEnrichmentCount > 0 && (
                  <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    Some need enrichment
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={selectAllAB}>
                  Select All A+B
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Link 
            to="/campaigns/new" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Job
          </Link>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleNext}
            disabled={selectedIds.size === 0}
          >
            Next: Configure Channels
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

// Helper function to check if candidate has contact info
function hasContact(candidate: MatchedCandidate): boolean {
  return !!(candidate.phone || candidate.personal_mobile || candidate.email || candidate.personal_email);
}

// Helper to check contact status
function getContactStatus(candidate: MatchedCandidate): "ready" | "partial" | "missing" {
  const hasPhone = !!(candidate.phone || candidate.personal_mobile);
  const hasEmail = !!(candidate.email || candidate.personal_email);
  
  if (hasPhone && hasEmail) return "ready";
  if (hasPhone || hasEmail) return "partial";
  return "missing";
}

// Tier Section Component
interface TierSectionProps {
  title: string;
  icon: React.ReactNode;
  candidates: MatchedCandidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "green" | "blue" | "gray";
  onEnrich: (candidate: MatchedCandidate) => void;
  enrichingIds: Set<string>;
}

const TierSection = ({
  title,
  icon,
  candidates,
  selectedIds,
  onToggle,
  isOpen,
  onOpenChange,
  variant,
  onEnrich,
  enrichingIds,
}: TierSectionProps) => {
  const headerColors = {
    green: "bg-green-500/10 border-green-500/30 text-green-600",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-600",
    gray: "bg-muted border-border text-muted-foreground",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className={cn("cursor-pointer border-b", headerColors[variant])}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {icon}
                {title}
                {isOpen && (
                  <Badge variant="secondary" className="ml-2">
                    {candidates.length}
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left w-10"></th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Specialty</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Licenses</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Score</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const contactStatus = getContactStatus(candidate);
                  const isEnriching = enrichingIds.has(candidate.id);
                  
                  return (
                    <tr
                      key={candidate.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(candidate.id)}
                          onCheckedChange={() => onToggle(candidate.id)}
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-foreground">
                          {candidate.first_name} {candidate.last_name}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {candidate.specialty || "—"}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {candidate.city && candidate.state
                          ? `${candidate.city}, ${candidate.state}`
                          : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">
                          {candidate.licenses?.length || 0} licenses
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full gradient-primary"
                              style={{ width: `${candidate.match_score || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {candidate.match_score || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {contactStatus === "ready" ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                            ✅ Ready
                          </Badge>
                        ) : contactStatus === "partial" ? (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                            ⚠️ Partial
                          </Badge>
                        ) : isEnriching ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="h-6 px-2 text-xs"
                          >
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Enriching...
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnrich(candidate);
                            }}
                            className="h-6 px-2 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                          >
                            🔍 Enrich
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default CampaignCandidates;
