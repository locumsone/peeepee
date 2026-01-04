import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Loader2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Star, Phone, X, Sparkles, Mail, MapPin
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParsedJob } from "@/components/jobs/ParsedJobCard";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
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
  work_email?: string;
  work_phone?: string;
}

interface SummaryData {
  total_matched: number;
  returned: number;
  tier_breakdown: {
    a_tier: number;
    b_tier: number;
    c_tier: number;
  };
  ready_to_contact: number;
  needs_enrichment: number;
}

interface ApiResponse {
  job: {
    id: string;
    name: string;
    facility: string;
    specialty: string;
    location: string;
    state: string;
    pay_rate: number;
    bill_rate: number;
  };
  summary: SummaryData;
  candidates: Candidate[];
}

type SortOption = "best_match" | "score" | "licenses" | "ready_to_contact";

// Score badge configuration
const getScoreBadgeConfig = (score: string) => {
  switch (score) {
    case "A+":
      return { 
        className: "bg-success text-success-foreground ring-2 ring-yellow-400", 
        label: "Tier 1" 
      };
    case "A":
      return { 
        className: "bg-success text-success-foreground", 
        label: "Tier 1" 
      };
    case "A-":
      return { 
        className: "bg-blue-500 text-white", 
        label: "Tier 2" 
      };
    case "B+":
      return { 
        className: "bg-blue-500 text-white", 
        label: "Tier 2" 
      };
    case "B":
      return { 
        className: "bg-warning text-warning-foreground", 
        label: "Tier 3" 
      };
    case "B-":
      return { 
        className: "bg-warning text-warning-foreground", 
        label: "Tier 3" 
      };
    default:
      return { 
        className: "bg-muted text-muted-foreground", 
        label: "Tier 4" 
      };
  }
};

// Enrichment tier badge configuration
const getEnrichmentBadgeConfig = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "platinum":
      return { 
        className: "bg-purple-500 text-white", 
        icon: <Sparkles className="h-3 w-3 mr-1" />,
        label: "Platinum"
      };
    case "gold":
      return { 
        className: "bg-yellow-500 text-yellow-900", 
        icon: null,
        label: "Gold"
      };
    case "silver":
      return { 
        className: "bg-gray-400 text-gray-900", 
        icon: null,
        label: "Silver"
      };
    case "bronze":
      return { 
        className: "bg-orange-600 text-white", 
        icon: null,
        label: "Bronze"
      };
    default:
      return { 
        className: "bg-muted text-muted-foreground", 
        icon: null,
        label: tier || "Unknown"
      };
  }
};

// Highlight key phrases in score reason
const highlightScoreReason = (reason: string) => {
  if (!reason) return null;
  
  const highlights: { pattern: RegExp; className: string }[] = [
    { pattern: /\b(WI license|WI License|Wisconsin license)\b/gi, className: "text-success font-semibold" },
    { pattern: /\bIMLc?\b/gi, className: "text-blue-400 font-semibold" },
    { pattern: /\blocal\b/gi, className: "text-success font-semibold" },
    { pattern: /\b(Gold tier|Gold Tier)\b/gi, className: "text-yellow-400 font-semibold" },
    { pattern: /\b(Platinum tier|Platinum Tier)\b/gi, className: "text-purple-400 font-semibold" },
  ];
  
  let result = reason;
  highlights.forEach(({ pattern, className }) => {
    result = result.replace(pattern, (match) => `<span class="${className}">${match}</span>`);
  });
  
  return <span className="italic text-muted-foreground text-sm" dangerouslySetInnerHTML={{ __html: result }} />;
};

const BATCH_SIZE = 25;

const CandidateMatching = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");
  
  const [job, setJob] = useState<(ParsedJob & { state?: string }) | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("best_match");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const effectiveJobId = jobId || "befd5ba5-4e46-41d9-b144-d4077f750035";

  const fetchCandidates = async (currentOffset: number, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/ai-candidate-matcher",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_id: effectiveJobId,
            limit: BATCH_SIZE,
            offset: currentOffset,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      console.log('API Response:', data);

      // Sort by match_strength DESC before adding
      const sortedCandidates = (data.candidates || []).sort((a, b) => b.match_strength - a.match_strength);

      if (append) {
        setCandidates(prev => [...prev, ...sortedCandidates]);
      } else {
        setCandidates(sortedCandidates);
        setSummary(data.summary || null);
        
        // Set job info from API response
        if (data.job) {
          setJob({
            specialty: data.job.specialty,
            facility: data.job.facility,
            location: data.job.location,
            state: data.job.state,
            dates: '',
            billRate: data.job.bill_rate,
            payRate: data.job.pay_rate,
          });
        }
      }
      
      // Check if there are more candidates to load
      setHasMore(sortedCandidates.length === BATCH_SIZE);
      setOffset(currentOffset + sortedCandidates.length);
    } catch (err) {
      console.error("Error fetching candidates:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch candidates");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCandidates(0, false);
  }, [effectiveJobId]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchCandidates(offset, true);
    }
  };

  // Sorted candidates
  const sortedCandidates = useMemo(() => {
    const sorted = [...candidates];
    switch (sortBy) {
      case "best_match":
        return sorted.sort((a, b) => b.match_strength - a.match_strength);
      case "score":
        return sorted.sort((a, b) => {
          const scoreOrder = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];
          return scoreOrder.indexOf(a.unified_score) - scoreOrder.indexOf(b.unified_score);
        });
      case "licenses":
        return sorted.sort((a, b) => b.licenses_count - a.licenses_count);
      case "ready_to_contact":
        return sorted.sort((a, b) => {
          const tierOrder = ["platinum", "gold", "silver", "bronze", ""];
          return tierOrder.indexOf(a.enrichment_tier?.toLowerCase() || "") - 
                 tierOrder.indexOf(b.enrichment_tier?.toLowerCase() || "");
        });
      default:
        return sorted;
    }
  }, [candidates, sortBy]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const selectAllATier = () => {
    const aTier = candidates.filter(c => c.unified_score.startsWith("A")).map(c => c.id);
    setSelectedIds(new Set(aTier));
  };

  const selectAllWithContact = () => {
    const withContact = candidates.filter(c => c.has_personal_contact).map(c => c.id);
    setSelectedIds(new Set(withContact));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleContinue = () => {
    const selected = candidates.filter(c => selectedIds.has(c.id));
    sessionStorage.setItem("selectedCandidates", JSON.stringify(selected));
    navigate("/campaign-builder");
  };

  // Get job state for indicator checks
  const jobState = job?.state || job?.location?.split(', ').pop() || 'WI';

  // Key indicators for a candidate
  const getKeyIndicators = (candidate: Candidate) => {
    const indicators: { label: string; className: string }[] = [];
    
    // Has job state license
    if (candidate.licenses?.some(l => l.includes(jobState))) {
      indicators.push({ 
        label: `Has ${jobState} License ✓`, 
        className: "bg-success/20 text-success border-success/30" 
      });
    }
    
    // Multi-state licenses
    if (candidate.licenses_count > 20) {
      indicators.push({ 
        label: `Multi-State (${candidate.licenses_count} licenses)`, 
        className: "bg-blue-500/20 text-blue-400 border-blue-500/30" 
      });
    }
    
    // Contact ready (Platinum)
    if (candidate.enrichment_tier?.toLowerCase() === "platinum") {
      indicators.push({ 
        label: "Contact Ready", 
        className: "bg-purple-500/20 text-purple-400 border-purple-500/30" 
      });
    }
    
    // Needs enrichment
    if (candidate.needs_enrichment) {
      indicators.push({ 
        label: "Needs Enrichment", 
        className: "bg-warning/20 text-warning border-warning/30" 
      });
    }
    
    // Local candidate
    if (candidate.state === jobState) {
      indicators.push({ 
        label: "Local Candidate", 
        className: "bg-success/20 text-success border-success/30" 
      });
    }
    
    return indicators;
  };

  // Stats - use summary from API or calculate from candidates
  const aTierCount = summary?.tier_breakdown?.a_tier ?? candidates.filter(c => c.unified_score.startsWith("A")).length;
  const bTierCount = summary?.tier_breakdown?.b_tier ?? candidates.filter(c => c.unified_score.startsWith("B")).length;
  const cTierCount = candidates.filter(c => c.unified_score.startsWith("C")).length;
  const needsEnrichmentCount = summary?.needs_enrichment ?? candidates.filter(c => c.needs_enrichment).length;
  const readyToContactCount = summary?.ready_to_contact ?? candidates.filter(c => c.enrichment_tier?.toLowerCase() === 'platinum').length;
  const totalCount = summary?.total_matched ?? candidates.length;

  if (isLoading) {
    return (
      <Layout currentStep={2}>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
              <Users className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">
              AI is Matching Candidates...
            </h2>
            <p className="text-muted-foreground">
              Analyzing skills, availability, and preferences
            </p>
          </div>
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout currentStep={2}>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Error Loading Candidates
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/job-entry")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentStep={2}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Tier Distribution Summary */}
        <div className="rounded-xl bg-secondary/50 border border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm font-medium">
            <span className="text-foreground">
              🔥 A-Tier: <span className="text-success">{aTierCount}</span>
            </span>
            <span className="text-foreground">
              ⭐ B-Tier: <span className="text-blue-400">{bTierCount}</span>
            </span>
            <span className="text-foreground">
              📋 C-Tier: <span className="text-warning">{cTierCount}</span>
            </span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {job?.specialty || "IR"} at {job?.facility || "Chippewa Valley"} | {job?.location || "Eau Claire, WI"} | <span className="text-success">${job?.payRate || 529}/hr</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Matched" value={totalCount} color="primary" />
          <StatCard label="Loaded" value={candidates.length} color="accent" />
          <StatCard label="Contact Ready" value={readyToContactCount} color="success" />
          <StatCard label="Needs Enrichment" value={needsEnrichmentCount} color="warning" />
        </div>

        {/* Bulk Actions & Sorting */}
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="outline" size="sm" onClick={selectAllATier}>
            <Star className="h-4 w-4 mr-1" />
            Select All A-Tier
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllWithContact}>
            <Phone className="h-4 w-4 mr-1" />
            Select All with Contact
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            Clear Selection
          </Button>
          
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best_match">Best Match</SelectItem>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="licenses">Most Licenses</SelectItem>
                <SelectItem value="ready_to_contact">Ready to Contact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={selectedIds.size === candidates.length && candidates.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(candidates.map(c => c.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enrichment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indicators</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sortedCandidates.map((candidate, index) => {
                  const scoreBadge = getScoreBadgeConfig(candidate.unified_score);
                  const enrichmentBadge = getEnrichmentBadgeConfig(candidate.enrichment_tier);
                  const indicators = getKeyIndicators(candidate);
                  
                  return (
                    <>
                      <tr 
                        key={candidate.id}
                        className={cn(
                          "border-b border-border/50 transition-colors hover:bg-secondary/30 cursor-pointer",
                          selectedIds.has(candidate.id) && "bg-primary/5"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => toggleExpand(candidate.id)}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(candidate.id)}
                            onCheckedChange={() => toggleSelect(candidate.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <span className="font-medium text-foreground">
                              {candidate.first_name} {candidate.last_name}
                            </span>
                            <p className="text-xs text-muted-foreground">{candidate.specialty}</p>
                            {candidate.score_reason && (
                              <div className="mt-1">
                                {highlightScoreReason(candidate.score_reason)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge className={cn("font-bold text-xs", scoreBadge.className)}>
                              {candidate.unified_score}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{scoreBadge.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={candidate.match_strength} className="h-2 flex-1" />
                            <span className="text-xs font-medium text-muted-foreground w-10">
                              {candidate.match_strength}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={cn("text-xs flex items-center w-fit", enrichmentBadge.className)}>
                            {enrichmentBadge.icon}
                            {enrichmentBadge.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {indicators.slice(0, 3).map((ind, i) => (
                              <Badge key={i} variant="outline" className={cn("text-[10px] border", ind.className)}>
                                {ind.label}
                              </Badge>
                            ))}
                            {indicators.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{indicators.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(candidate.id);
                            }}
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                          >
                            {expandedIds.has(candidate.id) ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedIds.has(candidate.id) && (
                        <tr key={`${candidate.id}-expanded`} className="bg-secondary/20">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-4 animate-fade-in">
                              {/* Icebreaker Callout */}
                              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                                  💡 Icebreaker
                                </p>
                                <p className="text-sm text-foreground">{candidate.icebreaker || "No icebreaker available"}</p>
                              </div>
                              
                              {/* Talking Points */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Talking Points
                                </p>
                                <ol className="list-decimal list-inside text-sm text-foreground space-y-1">
                                  {candidate.talking_points?.map((point, i) => (
                                    <li key={i}>{point}</li>
                                  )) || <li className="text-muted-foreground">No talking points available</li>}
                                </ol>
                              </div>
                              
                              {/* Licenses */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Licenses ({candidate.licenses_count} states)
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {candidate.licenses?.slice(0, 30).map((license, i) => (
                                    <Badge 
                                      key={i} 
                                      variant="outline" 
                                      className={cn(
                                        "text-[10px]",
                                        license.includes(jobState) && "bg-success/20 text-success border-success/30"
                                      )}
                                    >
                                      {license}
                                    </Badge>
                                  ))}
                                  {(candidate.licenses?.length || 0) > 30 && (
                                    <Badge variant="outline" className="text-[10px]">
                                      +{candidate.licenses.length - 30} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Contact Info */}
                              {(candidate.work_email || candidate.work_phone) && (
                                <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
                                  {candidate.work_email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-foreground">{candidate.work_email}</span>
                                    </div>
                                  )}
                                  {candidate.work_phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-foreground">{candidate.work_phone}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* All Indicators */}
                              {indicators.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {indicators.map((ind, i) => (
                                    <Badge key={i} variant="outline" className={cn("text-xs border", ind.className)}>
                                      {ind.label}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-4 py-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Showing 1-{candidates.length} of {totalCount} matched
          </span>
          {hasMore && (
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>Load {BATCH_SIZE} More</>
              )}
            </Button>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={() => navigate("/job-entry")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleContinue}
            disabled={selectedIds.size === 0}
          >
            Continue to Campaign
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: "primary" | "success" | "accent" | "warning";
}

const StatCard = ({ label, value, color }: StatCardProps) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <div className={cn("rounded-xl border p-4", colorClasses[color])}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
};

export default CandidateMatching;
