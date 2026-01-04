import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, X, Sparkles, RefreshCw, GripVertical, ChevronLeft, ChevronRight, Search, AlertTriangle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  city: string;
  unified_score: string;
  match_strength: number;
  licenses: string[];
  licenses_count: number;
  enrichment_tier: string;
  score_reason: string;
  icebreaker: string;
  talking_points: string[];
  has_personal_contact: boolean;
  needs_enrichment: boolean;
  personal_mobile?: string;
  personal_email?: string;
}

interface TierAssignments {
  tier1: Candidate[];
  tier2: Candidate[];
  tier3: Candidate[];
  tier4: Candidate[];
}

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

const assignToTier = (score: string): keyof TierAssignments => {
  if (score === "A+" || score === "A" || score === "A-") return "tier1";
  if (score === "B+" || score === "B" || score === "B-") return "tier2";
  if (score === "C+" || score === "C" || score === "C-") return "tier3";
  return "tier4";
};

const isReadyToContact = (candidate: Candidate): boolean => {
  return !!(candidate.personal_mobile || candidate.personal_email || candidate.has_personal_contact);
};

const getMissingInfo = (candidate: Candidate): string[] => {
  const missing: string[] = [];
  if (!candidate.personal_mobile) missing.push("Mobile Phone");
  if (!candidate.personal_email) missing.push("Personal Email");
  return missing;
};

const TierAssignment = () => {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<TierAssignments>({
    tier1: [],
    tier2: [],
    tier3: [],
    tier4: [],
  });
  const [selectTier1And2, setSelectTier1And2] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [enrichingTier, setEnrichingTier] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedCandidates");
    if (stored) {
      const candidates: Candidate[] = JSON.parse(stored);
      const assignments: TierAssignments = { tier1: [], tier2: [], tier3: [], tier4: [] };
      
      candidates.forEach(candidate => {
        const tier = assignToTier(candidate.unified_score);
        assignments[tier].push(candidate);
      });

      Object.keys(assignments).forEach(key => {
        assignments[key as keyof TierAssignments].sort((a, b) => b.match_strength - a.match_strength);
      });

      setTiers(assignments);
    }
  }, []);

  const handleAutoSort = () => {
    const allCandidates = [...tiers.tier1, ...tiers.tier2, ...tiers.tier3, ...tiers.tier4];
    const assignments: TierAssignments = { tier1: [], tier2: [], tier3: [], tier4: [] };
    
    allCandidates.forEach(candidate => {
      const tier = assignToTier(candidate.unified_score);
      assignments[tier].push(candidate);
    });

    Object.keys(assignments).forEach(key => {
      assignments[key as keyof TierAssignments].sort((a, b) => b.match_strength - a.match_strength);
    });

    setTiers(assignments);
    toast.success("Candidates sorted by score");
  };

  const moveCandidate = (
    candidateId: string,
    from: keyof TierAssignments,
    to: keyof TierAssignments
  ) => {
    const candidate = tiers[from].find(c => c.id === candidateId);
    if (!candidate) return;

    setTiers(prev => ({
      ...prev,
      [from]: prev[from].filter(c => c.id !== candidateId),
      [to]: [...prev[to], candidate].sort((a, b) => b.match_strength - a.match_strength),
    }));
  };

  const removeCandidate = (candidateId: string, from: keyof TierAssignments) => {
    setTiers(prev => ({
      ...prev,
      [from]: prev[from].filter(c => c.id !== candidateId),
    }));
    setRemovedIds(prev => new Set([...prev, candidateId]));
  };

  const handleEnrichTier = async (tierKey: keyof TierAssignments) => {
    const candidates = tiers[tierKey].filter(c => !isReadyToContact(c));
    if (candidates.length === 0) return;

    setEnrichingTier(tierKey);
    try {
      const records = candidates.map(c => ({
        candidate_id: c.id,
        signal_type: 'contact_info',
        status: 'pending',
        priority: tierKey === 'tier1' ? 1 : tierKey === 'tier2' ? 2 : 3,
      }));

      const { error } = await supabase
        .from('enrichment_queue')
        .upsert(records, { onConflict: 'candidate_id,signal_type' });

      if (error) throw error;
      toast.success(`Added ${candidates.length} candidates to enrichment queue`);
    } catch (err) {
      console.error('Enrichment error:', err);
      toast.error('Failed to add candidates to queue');
    } finally {
      setEnrichingTier(null);
    }
  };

  const tierStats = useMemo(() => {
    const stats: Record<keyof TierAssignments, { ready: number; needsEnrichment: number }> = {
      tier1: { ready: 0, needsEnrichment: 0 },
      tier2: { ready: 0, needsEnrichment: 0 },
      tier3: { ready: 0, needsEnrichment: 0 },
      tier4: { ready: 0, needsEnrichment: 0 },
    };

    (Object.keys(tiers) as (keyof TierAssignments)[]).forEach(tierKey => {
      tiers[tierKey].forEach(candidate => {
        if (isReadyToContact(candidate)) {
          stats[tierKey].ready++;
        } else {
          stats[tierKey].needsEnrichment++;
        }
      });
    });

    return stats;
  }, [tiers]);

  const totalSelected = useMemo(() => {
    if (selectTier1And2) {
      return tiers.tier1.length + tiers.tier2.length;
    }
    return tiers.tier1.length + tiers.tier2.length + tiers.tier3.length;
  }, [tiers, selectTier1And2]);

  const totalReady = tierStats.tier1.ready + tierStats.tier2.ready + tierStats.tier3.ready;
  const totalNeedsEnrichment = tierStats.tier1.needsEnrichment + tierStats.tier2.needsEnrichment + tierStats.tier3.needsEnrichment;
  const aTierNeedsEnrichment = tierStats.tier1.needsEnrichment;

  const canProceed = tiers.tier1.length + tiers.tier2.length + tiers.tier3.length > 0 && aTierNeedsEnrichment === 0;

  const handleNext = () => {
    const selectedCandidates = selectTier1And2 
      ? [...tiers.tier1, ...tiers.tier2]
      : [...tiers.tier1, ...tiers.tier2, ...tiers.tier3];
    
    sessionStorage.setItem("tieredCandidates", JSON.stringify(tiers));
    sessionStorage.setItem("selectedForCampaign", JSON.stringify(selectedCandidates));
    navigate("/campaign/review");
  };

  const tierConfigs: { key: keyof TierAssignments; title: string; emoji: string; headerClass: string; borderClass: string }[] = [
    { key: "tier1", title: "A-Tier", emoji: "🔥", headerClass: "bg-success/20 text-success", borderClass: "border-l-4 border-l-success" },
    { key: "tier2", title: "B-Tier", emoji: "⭐", headerClass: "bg-blue-500/20 text-blue-400", borderClass: "border-l-4 border-l-blue-500" },
    { key: "tier3", title: "C-Tier", emoji: "📋", headerClass: "bg-warning/20 text-warning", borderClass: "border-l-4 border-l-warning" },
    { key: "tier4", title: "Skip", emoji: "❌", headerClass: "bg-muted/50 text-muted-foreground", borderClass: "border-l-4 border-l-muted" },
  ];

  const tierOrder: (keyof TierAssignments)[] = ["tier1", "tier2", "tier3", "tier4"];

  return (
    <Layout currentStep={3}>
      <TooltipProvider>
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Top Action Bar */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleAutoSort}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Auto-Sort by Score
              </Button>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={selectTier1And2}
                  onCheckedChange={(checked) => setSelectTier1And2(!!checked)}
                />
                <span className="text-sm text-muted-foreground">Select All Tier 1 & 2</span>
              </label>
            </div>
            <div className="text-sm font-medium text-foreground">
              Total Selected: <span className="text-primary">{totalSelected}</span>
            </div>
          </div>

          {/* Tier Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {tierConfigs.map(({ key, title, emoji, headerClass, borderClass }) => {
              const candidates = tiers[key];
              const tierIndex = tierOrder.indexOf(key);
              const stats = tierStats[key];
              const hasNeedsEnrichment = stats.needsEnrichment > 0;

              return (
                <div key={key} className={cn("rounded-xl bg-card border border-border overflow-hidden flex flex-col", borderClass)}>
                  {/* Column Header */}
                  <div className={cn("px-4 py-3", headerClass)}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <span>{emoji}</span>
                        <span>{title} ({candidates.length})</span>
                      </h3>
                    </div>
                    {hasNeedsEnrichment && key !== 'tier4' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs h-7"
                        onClick={() => handleEnrichTier(key)}
                        disabled={enrichingTier === key}
                      >
                        <Search className="h-3 w-3 mr-1" />
                        {enrichingTier === key ? 'Adding...' : `Enrich All (${stats.needsEnrichment})`}
                      </Button>
                    )}
                  </div>

                  {/* Candidate Cards */}
                  <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto flex-1">
                    {candidates.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No candidates in this tier
                      </p>
                    )}
                    {candidates.map((candidate) => {
                      const scoreBadge = getScoreBadgeConfig(candidate.unified_score);
                      const enrichmentBadge = getEnrichmentBadgeConfig(candidate.enrichment_tier);
                      const ready = isReadyToContact(candidate);
                      const missing = getMissingInfo(candidate);

                      return (
                        <div
                          key={candidate.id}
                          className="bg-secondary/50 rounded-lg p-3 border border-border/50 relative group"
                        >
                          {/* Drag Handle */}
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 cursor-grab">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeCandidate(candidate.id, key)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>

                          <div className="pl-4 pr-6">
                            {/* Name with Status Dot */}
                            <div className="flex items-center gap-2 mb-2">
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className={cn(
                                    "h-2.5 w-2.5 rounded-full flex-shrink-0",
                                    ready ? "bg-success" : "bg-orange-500"
                                  )} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {ready ? (
                                    <p>Ready to contact</p>
                                  ) : (
                                    <div>
                                      <p className="font-medium mb-1">Missing:</p>
                                      <ul className="text-xs">
                                        {missing.map(m => <li key={m}>• {m}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                              <p className="font-medium text-foreground text-sm line-clamp-1">
                                {candidate.first_name} {candidate.last_name}
                              </p>
                            </div>

                            {/* Badges Row */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              <Badge className={cn("text-xs", scoreBadge.className)}>
                                {candidate.unified_score}
                              </Badge>
                              <Badge className={cn("text-xs", enrichmentBadge.className)}>
                                {enrichmentBadge.icon}
                                {enrichmentBadge.label}
                              </Badge>
                            </div>

                            {/* Match Strength */}
                            <div className="flex items-center gap-2">
                              <Progress value={candidate.match_strength} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground">
                                {candidate.match_strength}%
                              </span>
                            </div>

                            {/* Move Arrows */}
                            <div className="flex justify-center gap-2 mt-2">
                              {tierIndex > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveCandidate(candidate.id, key, tierOrder[tierIndex - 1])}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                              )}
                              {tierIndex < tierOrder.length - 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveCandidate(candidate.id, key, tierOrder[tierIndex + 1])}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tier Footer */}
                  {key !== 'tier4' && candidates.length > 0 && (
                    <div className="px-3 py-2 border-t border-border bg-secondary/30 text-xs text-muted-foreground">
                      Ready: {stats.ready} | Need Enrichment: {stats.needsEnrichment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Footer */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span>Ready: <strong>{totalReady}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span>Need Enrichment: <strong>{totalNeedsEnrichment}</strong></span>
                </div>
              </div>

              {aTierNeedsEnrichment > 0 && (
                <div className="flex items-center gap-2 text-warning text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{aTierNeedsEnrichment} A-tier candidates need enrichment before launch</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => navigate("/candidates/matching")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Matching
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    variant="gradient"
                  >
                    Proceed to Review
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canProceed && aTierNeedsEnrichment > 0 && (
                <TooltipContent>
                  Enrich all A-tier candidates before proceeding
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </Layout>
  );
};

export default TierAssignment;
