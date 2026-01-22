import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Loader2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Star, Phone, X, Sparkles, Mail, MapPin, Search, Globe,
  Filter, Shield, Zap, Target, Award
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParsedJob } from "@/components/jobs/ParsedJobCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  score_reason: string;
  icebreaker: string;
  talking_points: string[];
  has_personal_contact: boolean;
  needs_enrichment: boolean;
  is_enriched?: boolean;
  work_email?: string;
  work_phone?: string;
  personal_mobile?: string;
  personal_email?: string;
  source?: string;
  // Research fields
  researched?: boolean;
  has_imlc?: boolean;
  npi?: string;
  verified_npi?: boolean;
  match_concerns?: string[];
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
  alpha_sophia_count?: number;
  alpha_sophia_searched?: boolean;
  ai_scored?: boolean;
  alpha_sophia_limit?: {
    allowed: boolean;
    remaining: number;
    used_today: number;
    daily_limit: number;
    is_admin: boolean;
  } | null;
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
  config?: {
    min_local_threshold: number;
    max_results_per_search: number;
  };
}

type SortOption = "contact_first" | "enriched_first" | "best_match" | "most_licenses" | "local_first" | "score";
type QuickFilter = "all" | "contact_ready" | "enriched_personal" | "10_plus_licenses" | "5_plus_licenses" | "local" | "needs_enrichment";

// Enriched sources that indicate verified personal contact info
const ENRICHED_SOURCES = ['Whitepages', 'PDL', 'Apollo', 'Hunter', 'Clearbit', 'ZoomInfo'];

// Score badge configuration
const getScoreBadgeConfig = (score: string) => {
  switch (score) {
    case "A+":
      return { className: "bg-success text-success-foreground ring-2 ring-yellow-400", label: "Tier 1" };
    case "A":
      return { className: "bg-success text-success-foreground", label: "Tier 1" };
    case "A-":
    case "B+":
      return { className: "bg-blue-500 text-white", label: "Tier 2" };
    case "B":
    case "B-":
      return { className: "bg-warning text-warning-foreground", label: "Tier 3" };
    default:
      return { className: "bg-muted text-muted-foreground", label: "Tier 4" };
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

// Highlight key phrases in score reason
const highlightScoreReason = (reason: string) => {
  if (!reason) return null;
  
  const highlights: { pattern: RegExp; className: string }[] = [
    { pattern: /\b(WI license|WI License|Wisconsin license|TX license|TX License)\b/gi, className: "text-success font-semibold" },
    { pattern: /\bIMLc?\b/gi, className: "text-blue-400 font-semibold" },
    { pattern: /\blocal\b/gi, className: "text-success font-semibold" },
    { pattern: /\b(Gold tier|Gold Tier)\b/gi, className: "text-yellow-400 font-semibold" },
    { pattern: /\b(Platinum tier|Platinum Tier)\b/gi, className: "text-purple-400 font-semibold" },
  ];
  
  type MatchInfo = { index: number; length: number; text: string; className: string };
  const matches: MatchInfo[] = [];
  
  highlights.forEach(({ pattern, className }) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(reason)) !== null) {
      matches.push({ index: match.index, length: match[0].length, text: match[0], className });
    }
  });
  
  matches.sort((a, b) => a.index - b.index);
  const filteredMatches: MatchInfo[] = [];
  let lastEnd = 0;
  matches.forEach(m => {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  });
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  filteredMatches.forEach((m, i) => {
    if (m.index > lastIndex) parts.push(reason.substring(lastIndex, m.index));
    parts.push(<span key={i} className={m.className}>{m.text}</span>);
    lastIndex = m.index + m.length;
  });
  if (lastIndex < reason.length) parts.push(reason.substring(lastIndex));
  
  return <span className="italic text-muted-foreground text-sm">{parts}</span>;
};

const BATCH_SIZE = 25;

const CandidateMatching = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { user } = useAuth();
  
  const [job, setJob] = useState<(ParsedJob & { state?: string }) | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("enriched_first");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [searchingAlphaSophia, setSearchingAlphaSophia] = useState(false);
  const [alphaSophiaSearched, setAlphaSophiaSearched] = useState(false);
  const [alphaSophiaLimit, setAlphaSophiaLimit] = useState<SummaryData['alpha_sophia_limit']>(null);
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());
  const [autoResearchDone, setAutoResearchDone] = useState(false);
  const [bulkResearching, setBulkResearching] = useState(false);

  const effectiveJobId = jobId || "befd5ba5-4e46-41d9-b144-d4077f750035";
  const jobState = job?.state || job?.location?.split(', ').pop() || 'TX';

  // Helper functions
  // Check if candidate has verified enriched personal contact (from Whitepages/PDL/etc)
  const isEnrichedPersonal = (c: Candidate) => 
    c.is_enriched || (c.enrichment_source && ENRICHED_SOURCES.includes(c.enrichment_source));
  
  // Check if candidate has any contact info (personal or work)
  const isContactReady = (c: Candidate) => 
    c.personal_mobile || c.personal_email || c.has_personal_contact || 
    ['platinum', 'gold'].includes(c.enrichment_tier?.toLowerCase() || '') ||
    isEnrichedPersonal(c);
  
  const isLocal = (c: Candidate) => c.state === jobState;
  const has10PlusLicenses = (c: Candidate) => c.licenses_count >= 10;
  const has5PlusLicenses = (c: Candidate) => c.licenses_count >= 5;
  const needsEnrichment = (c: Candidate) => 
    c.needs_enrichment && !isEnrichedPersonal(c);

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: effectiveJobId,
            limit: BATCH_SIZE,
            offset: currentOffset,
            user_id: user?.id || null,
          }),
        }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data: ApiResponse = await response.json();
      
      // Sort by contact-ready first, then match strength
      const sortedCandidates = (data.candidates || []).sort((a, b) => {
        const aReady = isContactReady(a) ? 1 : 0;
        const bReady = isContactReady(b) ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        return b.match_strength - a.match_strength;
      });

      if (append) {
        setCandidates(prev => [...prev, ...sortedCandidates]);
      } else {
        setCandidates(sortedCandidates);
        setSummary(data.summary || null);
        
        if (data.summary?.alpha_sophia_limit) {
          setAlphaSophiaLimit(data.summary.alpha_sophia_limit);
        }
        
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

  // Search Alpha Sophia
  const searchAlphaSophia = async () => {
    if (alphaSophiaLimit && !alphaSophiaLimit.allowed) {
      toast.error(`Daily limit reached (${alphaSophiaLimit.used_today}/${alphaSophiaLimit.daily_limit})`);
      return;
    }

    setSearchingAlphaSophia(true);
    
    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/ai-candidate-matcher",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: effectiveJobId,
            limit: 50,
            offset: 0,
            force_alpha_sophia: true,
            user_id: user?.id || null,
          }),
        }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data: ApiResponse = await response.json();
      
      if (data.summary?.alpha_sophia_limit) {
        setAlphaSophiaLimit(data.summary.alpha_sophia_limit);
      }

      const existingIds = new Set(candidates.map(c => c.id));
      const newCandidates = (data.candidates || []).filter(c => !existingIds.has(c.id));
      
      if (newCandidates.length > 0) {
        setCandidates(prev => [...prev, ...newCandidates].sort((a, b) => {
          const aReady = isContactReady(a) ? 1 : 0;
          const bReady = isContactReady(b) ? 1 : 0;
          if (aReady !== bReady) return bReady - aReady;
          return b.match_strength - a.match_strength;
        }));
        toast.success(`Found ${newCandidates.length} additional candidates from Alpha Sophia`);
      } else {
        toast.info("No additional candidates found in Alpha Sophia");
      }
      
      if (data.summary) {
        setSummary(prev => ({
          ...prev,
          ...data.summary,
          total_matched: (prev?.total_matched || 0) + newCandidates.length,
        }));
      }
      
      setAlphaSophiaSearched(true);
    } catch (err) {
      console.error("Alpha Sophia search error:", err);
      toast.error("Failed to search Alpha Sophia");
    } finally {
      setSearchingAlphaSophia(false);
    }
  };

  // Enrichment handlers
  const handleEnrichCandidate = async (candidate: Candidate) => {
    setEnrichingIds(prev => new Set(prev).add(candidate.id));
    
    try {
      const { error } = await supabase
        .from("enrichment_queue")
        .insert({
          candidate_id: candidate.id,
          signal_type: "contact_enrichment",
          status: "pending",
          priority: 2,
        });

      if (error) throw error;
      toast.success("Added to enrichment queue");
    } catch (error: any) {
      console.error("Error adding to queue:", error);
      toast.error(error.message || "Failed to add to queue");
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(candidate.id);
        return next;
      });
    }
  };

  const handleBulkEnrich = async () => {
    const candidatesToEnrich = candidates.filter(c => selectedIds.has(c.id) && needsEnrichment(c));

    if (candidatesToEnrich.length === 0) {
      toast.error("No candidates needing enrichment selected");
      return;
    }

    setBulkEnriching(true);
    
    try {
      const inserts = candidatesToEnrich.map(c => ({
        candidate_id: c.id,
        signal_type: "contact_enrichment",
        status: "pending",
        priority: 2,
      }));

      const { error } = await supabase.from("enrichment_queue").insert(inserts);
      if (error) throw error;
      
      toast.success(`Added ${candidatesToEnrich.length} candidates to enrichment queue`);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Error bulk adding to queue:", error);
      toast.error(error.message || "Failed to add to queue");
    } finally {
      setBulkEnriching(false);
    }
  };

  // Research candidates via NPI + AI
  const researchCandidates = async (candidateIds: string[], skipResearch = false) => {
    const candidatesToResearch = candidates.filter(c => candidateIds.includes(c.id));
    
    if (candidatesToResearch.length === 0) return;
    
    setResearchingIds(prev => new Set([...prev, ...candidateIds]));
    
    try {
      const response = await fetch(
        "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/candidate-research",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidates: candidatesToResearch.map(c => ({
              id: c.id,
              first_name: c.first_name,
              last_name: c.last_name,
              specialty: c.specialty,
              state: c.state,
              npi: c.npi,
              licenses: c.licenses,
            })),
            job: {
              id: effectiveJobId,
              specialty: job?.specialty,
              state: jobState,
              raw_job_text: (job as any)?.raw_job_text,
            },
            skip_research: skipResearch,
          }),
        }
      );

      if (!response.ok) throw new Error(`Research API error: ${response.status}`);

      const data = await response.json();
      
      // Update candidates with research results
      setCandidates(prev => prev.map(c => {
        const result = data.results?.find((r: any) => r.id === c.id);
        if (!result) return c;
        
        return {
          ...c,
          researched: true,
          verified_npi: result.verified_npi,
          has_imlc: result.match_analysis?.has_imlc,
          unified_score: result.match_analysis?.grade || c.unified_score,
          match_strength: result.match_analysis?.score || c.match_strength,
          score_reason: result.match_analysis?.reasons?.join(' • ') || c.score_reason,
          icebreaker: result.match_analysis?.icebreaker || c.icebreaker,
          talking_points: result.match_analysis?.talking_points || c.talking_points,
          match_concerns: result.match_analysis?.concerns || [],
        };
      }));
      
      if (!skipResearch) {
        toast.success(`Researched ${data.researched_count} candidates`);
      }
    } catch (error: any) {
      console.error("Research error:", error);
      toast.error(error.message || "Failed to research candidates");
    } finally {
      setResearchingIds(prev => {
        const next = new Set(prev);
        candidateIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  // Auto-research A-tier candidates when loaded
  useEffect(() => {
    if (!autoResearchDone && candidates.length > 0 && !isLoading) {
      const aTierCandidates = candidates.filter(c => 
        c.unified_score?.startsWith('A') && !c.researched
      );
      
      if (aTierCandidates.length > 0 && aTierCandidates.length <= 10) {
        console.log(`Auto-researching ${aTierCandidates.length} A-tier candidates`);
        researchCandidates(aTierCandidates.map(c => c.id));
      }
      setAutoResearchDone(true);
    }
  }, [candidates, isLoading, autoResearchDone]);

  // Research single candidate
  const handleResearchCandidate = (candidate: Candidate) => {
    researchCandidates([candidate.id]);
  };

  // Skip research (quick score)
  const handleSkipResearch = (candidate: Candidate) => {
    researchCandidates([candidate.id], true);
  };

  // Bulk research selected candidates
  const handleBulkResearch = async () => {
    const candidatesToResearch = candidates.filter(c => 
      selectedIds.has(c.id) && !c.researched
    );

    if (candidatesToResearch.length === 0) {
      toast.error("No unresearched candidates selected");
      return;
    }

    setBulkResearching(true);
    
    try {
      await researchCandidates(candidatesToResearch.map(c => c.id));
      toast.success(`Researched ${candidatesToResearch.length} candidates with NPI verification + AI scoring`);
    } catch (error: any) {
      console.error("Bulk research error:", error);
      toast.error(error.message || "Failed to research candidates");
    } finally {
      setBulkResearching(false);
    }
  };

  // Count selected candidates needing research
  const selectedNeedingResearch = useMemo(() => 
    candidates.filter(c => selectedIds.has(c.id) && !c.researched).length
  , [candidates, selectedIds]);

  // Filter counts - wrap in useCallback to prevent stale closures
  const filterCounts = useMemo(() => ({
    all: candidates.length,
    contact_ready: candidates.filter(c => isContactReady(c)).length,
    enriched_personal: candidates.filter(c => isEnrichedPersonal(c)).length,
    "10_plus_licenses": candidates.filter(c => has10PlusLicenses(c)).length,
    "5_plus_licenses": candidates.filter(c => has5PlusLicenses(c)).length,
    local: candidates.filter(c => isLocal(c)).length,
    needs_enrichment: candidates.filter(c => needsEnrichment(c)).length,
  }), [candidates, jobState]);

  // Filtered candidates - use explicit callbacks to avoid stale closures
  const filteredCandidates = useMemo(() => {
    let filtered = [...candidates];
    
    // Apply quick filter
    if (quickFilter === "contact_ready") {
      filtered = filtered.filter(c => isContactReady(c));
    } else if (quickFilter === "enriched_personal") {
      filtered = filtered.filter(c => isEnrichedPersonal(c));
    } else if (quickFilter === "10_plus_licenses") {
      filtered = filtered.filter(c => has10PlusLicenses(c));
    } else if (quickFilter === "5_plus_licenses") {
      filtered = filtered.filter(c => has5PlusLicenses(c));
    } else if (quickFilter === "local") {
      filtered = filtered.filter(c => isLocal(c));
    } else if (quickFilter === "needs_enrichment") {
      filtered = filtered.filter(c => needsEnrichment(c));
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.first_name?.toLowerCase().includes(query) ||
        c.last_name?.toLowerCase().includes(query) ||
        c.specialty?.toLowerCase().includes(query) ||
        c.state?.toLowerCase().includes(query) ||
        c.city?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [candidates, quickFilter, searchQuery, jobState]);

  // Sorted candidates
  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    switch (sortBy) {
      case "enriched_first":
        return sorted.sort((a, b) => {
          const aEnriched = isEnrichedPersonal(a) ? 2 : (isContactReady(a) ? 1 : 0);
          const bEnriched = isEnrichedPersonal(b) ? 2 : (isContactReady(b) ? 1 : 0);
          if (aEnriched !== bEnriched) return bEnriched - aEnriched;
          return b.match_strength - a.match_strength;
        });
      case "contact_first":
        return sorted.sort((a, b) => {
          const aReady = isContactReady(a) ? 1 : 0;
          const bReady = isContactReady(b) ? 1 : 0;
          if (aReady !== bReady) return bReady - aReady;
          return b.match_strength - a.match_strength;
        });
      case "best_match":
        return sorted.sort((a, b) => b.match_strength - a.match_strength);
      case "most_licenses":
        return sorted.sort((a, b) => b.licenses_count - a.licenses_count);
      case "local_first":
        return sorted.sort((a, b) => {
          const aLocal = isLocal(a) ? 1 : 0;
          const bLocal = isLocal(b) ? 1 : 0;
          if (aLocal !== bLocal) return bLocal - aLocal;
          return b.match_strength - a.match_strength;
        });
      case "score":
        return sorted.sort((a, b) => {
          const scoreOrder = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];
          return scoreOrder.indexOf(a.unified_score) - scoreOrder.indexOf(b.unified_score);
        });
      default:
        return sorted;
    }
  }, [filteredCandidates, sortBy, jobState]);

  // Selection helpers
  const selectedNeedingEnrichment = useMemo(() => 
    candidates.filter(c => selectedIds.has(c.id) && needsEnrichment(c)).length
  , [candidates, selectedIds]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const selectAllContactReady = () => {
    const ready = candidates.filter(isContactReady).map(c => c.id);
    setSelectedIds(new Set(ready));
  };

  const selectAll10Plus = () => {
    const licenses = candidates.filter(has10PlusLicenses).map(c => c.id);
    setSelectedIds(new Set(licenses));
  };

  const selectAllLocal = () => {
    const local = candidates.filter(isLocal).map(c => c.id);
    setSelectedIds(new Set(local));
  };

  const handleContinue = () => {
    const selected = candidates.filter(c => selectedIds.has(c.id));
    sessionStorage.setItem("selectedCandidates", JSON.stringify(selected));
    navigate("/campaigns/new/channels");
  };

  // Key indicators for a candidate
  const getKeyIndicators = (candidate: Candidate) => {
    const indicators: { label: string; className: string; priority: number }[] = [];
    
    // Researched/Verified (highest priority)
    if (candidate.researched || candidate.verified_npi) {
      indicators.push({ 
        label: "🔬 Researched", 
        className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
        priority: -1
      });
    }
    
    // Enriched Personal Contact (verified by Whitepages/PDL - PERSONAL info)
    if (isEnrichedPersonal(candidate) && (candidate.personal_mobile || candidate.personal_email)) {
      indicators.push({ 
        label: `✅ Personal Contact (${candidate.enrichment_source || 'Enriched'})`, 
        className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        priority: 0
      });
    } else if (candidate.personal_mobile || candidate.personal_email) {
      // Has personal contact but source unknown
      indicators.push({ 
        label: "📱 Personal Contact", 
        className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        priority: 0
      });
    } else if ((candidate.work_phone || candidate.work_email) && !candidate.personal_mobile && !candidate.personal_email) {
      // ONLY has work/company contact - NOT personal
      indicators.push({ 
        label: "🏢 Company Contact Only", 
        className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        priority: 7
      });
    } else if (!isContactReady(candidate)) {
      // No contact at all
      indicators.push({ 
        label: "❌ No Contact", 
        className: "bg-destructive/20 text-destructive border-destructive/30",
        priority: 9
      });
    }
    
    // IMLC indicator (for 10+ licenses without job state)
    if (candidate.has_imlc) {
      indicators.push({ 
        label: "🏛️ IMLC Eligible", 
        className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        priority: 2
      });
    } else if (candidate.licenses?.some(l => l.toUpperCase().includes(jobState.toUpperCase()))) {
      // Has job state license
      indicators.push({ 
        label: `${jobState} Licensed ✓`, 
        className: "bg-success/20 text-success border-success/30",
        priority: 2
      });
    } else if (candidate.licenses_count >= 10) {
      // 10+ licenses but no explicit job state - likely IMLC
      indicators.push({ 
        label: `🏛️ Likely IMLC (${candidate.licenses_count} states)`, 
        className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        priority: 2
      });
    }
    
    // Multi-state licenses (if not already shown via IMLC)
    if (candidate.licenses_count >= 10 && !candidate.has_imlc && candidate.licenses?.some(l => l.toUpperCase().includes(jobState.toUpperCase()))) {
      indicators.push({ 
        label: `🌟 ${candidate.licenses_count} States`, 
        className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        priority: 3
      });
    } else if (candidate.licenses_count >= 5 && candidate.licenses_count < 10) {
      indicators.push({ 
        label: `${candidate.licenses_count} States`, 
        className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        priority: 4
      });
    }
    
    // Local candidate
    if (isLocal(candidate)) {
      indicators.push({ 
        label: "📍 Local", 
        className: "bg-success/20 text-success border-success/30",
        priority: 5
      });
    }
    
    // Alpha Sophia source
    if (candidate.source === 'alpha_sophia' || candidate.enrichment_tier === 'Alpha Sophia') {
      indicators.push({ 
        label: "Alpha Sophia", 
        className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        priority: 6
      });
    }
    
    // Needs enrichment (for candidates with only company contact)
    if (needsEnrichment(candidate) && !candidate.personal_mobile && !candidate.personal_email) {
      indicators.push({ 
        label: "🔍 Needs Enrichment", 
        className: "bg-warning/20 text-warning border-warning/30",
        priority: 10
      });
    }
    
    return indicators.sort((a, b) => a.priority - b.priority);
  };

  // Stats
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
            <h2 className="font-display text-2xl font-bold text-foreground">AI is Matching Candidates...</h2>
            <p className="text-muted-foreground">Analyzing skills, availability, and preferences</p>
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
            <h2 className="font-display text-2xl font-bold text-foreground">Error Loading Candidates</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/jobs/new")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentStep={2}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Job Summary Header */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {job?.specialty || "IR"} at {job?.facility || "Facility"}
              </h1>
              <p className="text-muted-foreground">{job?.location || "Location"} • <span className="text-success font-semibold">${job?.payRate || 0}/hr</span></p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {summary?.ai_scored && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Scored
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{filterCounts.contact_ready}</p>
                <p className="text-xs text-muted-foreground">Contact Ready</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{filterCounts["10_plus_licenses"]}</p>
                <p className="text-xs text-muted-foreground">10+ Licenses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{filterCounts.local}</p>
                <p className="text-xs text-muted-foreground">Local ({jobState})</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Filters - Prominent */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <QuickFilterButton 
            active={quickFilter === "all"} 
            onClick={() => setQuickFilter("all")}
            icon={<Users className="h-4 w-4" />}
            label="All"
            count={filterCounts.all}
          />
          <QuickFilterButton 
            active={quickFilter === "enriched_personal"} 
            onClick={() => setQuickFilter("enriched_personal")}
            icon={<Sparkles className="h-4 w-4" />}
            label="Enriched Personal"
            count={filterCounts.enriched_personal}
            highlight="success"
            description="Whitepages/PDL verified"
          />
          <QuickFilterButton 
            active={quickFilter === "contact_ready"} 
            onClick={() => setQuickFilter("contact_ready")}
            icon={<Phone className="h-4 w-4" />}
            label="Any Contact"
            count={filterCounts.contact_ready}
            highlight="blue"
            description="Has any contact info"
          />
          <QuickFilterButton 
            active={quickFilter === "10_plus_licenses"} 
            onClick={() => setQuickFilter("10_plus_licenses")}
            icon={<Award className="h-4 w-4" />}
            label="10+ Licenses"
            count={filterCounts["10_plus_licenses"]}
            highlight="purple"
            description="Top locum travelers"
          />
          <QuickFilterButton 
            active={quickFilter === "5_plus_licenses"} 
            onClick={() => setQuickFilter("5_plus_licenses")}
            icon={<Shield className="h-4 w-4" />}
            label="5+ Licenses"
            count={filterCounts["5_plus_licenses"]}
            description="Multi-state licensed"
          />
          <QuickFilterButton 
            active={quickFilter === "local"} 
            onClick={() => setQuickFilter("local")}
            icon={<MapPin className="h-4 w-4" />}
            label={`Local (${jobState})`}
            count={filterCounts.local}
            highlight="green"
            description="In-state candidates"
          />
          <QuickFilterButton 
            active={quickFilter === "needs_enrichment"} 
            onClick={() => setQuickFilter("needs_enrichment")}
            icon={<Search className="h-4 w-4" />}
            label="Needs Enrichment"
            count={filterCounts.needs_enrichment}
            highlight="warning"
            description="Missing personal contact"
          />
        </div>

        {/* Alpha Sophia Banner */}
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {alphaSophiaSearched 
                  ? `Alpha Sophia: ${candidates.filter(c => c.source === 'alpha_sophia').length} external candidates`
                  : "Search Alpha Sophia for more physicians"
                }
              </p>
              {alphaSophiaLimit && (
                <p className="text-xs text-muted-foreground">
                  Usage: {alphaSophiaLimit.used_today}/{alphaSophiaLimit.daily_limit}
                  {!alphaSophiaLimit.allowed && <span className="text-destructive ml-1">• Limit reached</span>}
                </p>
              )}
            </div>
          </div>
          <Button
            variant={alphaSophiaSearched ? "outline" : "default"}
            size="sm"
            onClick={searchAlphaSophia}
            disabled={searchingAlphaSophia || (alphaSophiaLimit && !alphaSophiaLimit.allowed)}
            className={alphaSophiaSearched ? "border-blue-500/30 text-blue-400" : "bg-blue-600 hover:bg-blue-700"}
          >
            {searchingAlphaSophia ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            {alphaSophiaSearched ? "Search Again" : "Search Alpha Sophia"}
          </Button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, specialty, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAllContactReady}>
              <Phone className="h-4 w-4 mr-1" />
              Select Contact Ready
            </Button>
            <Button variant="outline" size="sm" onClick={selectAll10Plus}>
              <Award className="h-4 w-4 mr-1" />
              Select 10+ Licenses
            </Button>
            <Button variant="outline" size="sm" onClick={selectAllLocal}>
              <MapPin className="h-4 w-4 mr-1" />
              Select Local
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4 mr-1" />
                Clear ({selectedIds.size})
              </Button>
            )}
          </div>
          
          {selectedNeedingResearch > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkResearch}
              disabled={bulkResearching || researchingIds.size > 0}
              className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/20"
            >
              {bulkResearching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Target className="h-4 w-4 mr-1" />}
              Research {selectedNeedingResearch} Selected
            </Button>
          )}
          
          {selectedNeedingEnrichment > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkEnrich}
              disabled={bulkEnriching}
              className="bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20"
            >
              {bulkEnriching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Enrich {selectedNeedingEnrichment} Selected
            </Button>
          )}
          
          <div className="ml-auto">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enriched_first">✅ Enriched First</SelectItem>
                <SelectItem value="contact_first">📞 Any Contact First</SelectItem>
                <SelectItem value="best_match">🎯 Best Match</SelectItem>
                <SelectItem value="most_licenses">🏆 Most Licenses</SelectItem>
                <SelectItem value="local_first">📍 Local First</SelectItem>
                <SelectItem value="score">⭐ Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-muted-foreground">
          Showing {sortedCandidates.length} of {totalCount} candidates
          {quickFilter !== "all" && ` • Filtered: ${quickFilter.replace(/_/g, ' ')}`}
        </div>

        {/* Candidates Table */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={selectedIds.size === sortedCandidates.length && sortedCandidates.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedIds(new Set(sortedCandidates.map(c => c.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Info</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {sortedCandidates.map((candidate, index) => {
                  const scoreBadge = getScoreBadgeConfig(candidate.unified_score);
                  const enrichmentBadge = getEnrichmentBadgeConfig(candidate.enrichment_tier);
                  const indicators = getKeyIndicators(candidate);
                  const contactReady = isContactReady(candidate);
                  
                  return (
                    <>
                      <tr 
                        key={candidate.id}
                        className={cn(
                          "border-b border-border/50 transition-colors cursor-pointer",
                          selectedIds.has(candidate.id) && "bg-primary/5",
                          contactReady ? "hover:bg-success/5" : "hover:bg-secondary/30"
                        )}
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {candidate.first_name} {candidate.last_name}
                              </span>
                              {contactReady && (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              )}
                              {/* Research & NPI verification badges */}
                              {candidate.researched && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] bg-cyan-500/10 text-cyan-500 border-cyan-500/30 gap-1"
                                >
                                  🔬 Researched
                                </Badge>
                              )}
                              {candidate.verified_npi && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1"
                                >
                                  <Shield className="h-3 w-3" /> NPI ✓
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{candidate.specialty}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{candidate.city}, {candidate.state}</p>
                              {candidate.npi && (
                                <span className="text-[10px] text-muted-foreground/70">NPI: {candidate.npi}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={cn("font-bold text-xs", scoreBadge.className)}>
                            {candidate.unified_score}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={candidate.match_strength} className="h-2 flex-1" />
                            <span className="text-xs font-medium text-muted-foreground w-8">
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
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {indicators.slice(0, 3).map((ind, i) => (
                              <Badge key={i} variant="outline" className={cn("text-[10px] border", ind.className)}>
                                {ind.label}
                              </Badge>
                            ))}
                            {indicators.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">+{indicators.length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {/* Research button */}
                            {!candidate.researched && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10"
                                disabled={researchingIds.has(candidate.id)}
                                onClick={() => handleResearchCandidate(candidate)}
                                title="Research via NPI + AI"
                              >
                                {researchingIds.has(candidate.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>🔬</>
                                )}
                              </Button>
                            )}
                            {/* Enrich button */}
                            {needsEnrichment(candidate) && !contactReady && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
                                disabled={enrichingIds.has(candidate.id)}
                                onClick={() => handleEnrichCandidate(candidate)}
                              >
                                {enrichingIds.has(candidate.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>🔍</>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(candidate.id); }}
                            className="text-primary hover:text-primary/80"
                          >
                            {expandedIds.has(candidate.id) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        </td>
                      </tr>
                      {expandedIds.has(candidate.id) && (
                        <tr key={`${candidate.id}-expanded`} className="bg-secondary/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-4 animate-fade-in">
                              {/* Research Status Banner */}
                              {candidate.researched && (
                                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-4 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                      <Target className="h-5 w-5 text-cyan-500" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                        AI Research Complete
                                        {candidate.verified_npi && (
                                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                                            <Shield className="h-3 w-3 mr-1" /> NPI Verified
                                          </Badge>
                                        )}
                                        {candidate.has_imlc && (
                                          <Badge className="bg-indigo-500/20 text-indigo-500 border-indigo-500/30 text-[10px]">
                                            🏛️ IMLC Eligible
                                          </Badge>
                                        )}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Credentials verified via NPI Registry • AI-scored match analysis
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={cn("text-sm font-bold", getScoreBadgeConfig(candidate.unified_score).className)}>
                                      {candidate.unified_score} Match
                                    </Badge>
                                    <span className="text-lg font-bold text-foreground">{candidate.match_strength}%</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Not Researched Banner */}
                              {!candidate.researched && (
                                <div className="rounded-lg bg-muted/50 border border-border p-4 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                      <Search className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Not Yet Researched</p>
                                      <p className="text-xs text-muted-foreground">
                                        Click research to verify NPI & get AI-powered match analysis
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10"
                                    disabled={researchingIds.has(candidate.id)}
                                    onClick={() => handleResearchCandidate(candidate)}
                                  >
                                    {researchingIds.has(candidate.id) ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Target className="h-4 w-4 mr-2" />
                                    )}
                                    Research Now
                                  </Button>
                                </div>
                              )}

                              {/* Icebreaker */}
                              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">💡 Icebreaker</p>
                                <p className="text-sm text-foreground">{candidate.icebreaker || "No icebreaker available"}</p>
                              </div>
                              
                              {/* Score Reason */}
                              {candidate.score_reason && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Why This Match</p>
                                  {highlightScoreReason(candidate.score_reason)}
                                </div>
                              )}
                              
                              {/* Talking Points */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Talking Points</p>
                                <ol className="list-decimal list-inside text-sm text-foreground space-y-1">
                                  {candidate.talking_points?.map((point, i) => <li key={i}>{point}</li>) || 
                                   <li className="text-muted-foreground">No talking points available</li>}
                                </ol>
                              </div>
                              
                              {/* Licenses */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Licenses ({candidate.licenses_count} states)
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {candidate.licenses?.slice(0, 30).map((license, i) => (
                                    <Badge key={i} variant="outline" className={cn("text-[10px]", license.includes(jobState) && "bg-success/20 text-success border-success/30")}>
                                      {license}
                                    </Badge>
                                  ))}
                                  {(candidate.licenses?.length || 0) > 30 && (
                                    <Badge variant="outline" className="text-[10px]">+{candidate.licenses.length - 30} more</Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Match Concerns */}
                              {candidate.match_concerns && candidate.match_concerns.length > 0 && (
                                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">⚠️ Concerns</p>
                                  <ul className="list-disc list-inside text-sm text-destructive/80 space-y-1">
                                    {candidate.match_concerns.map((concern, i) => <li key={i}>{concern}</li>)}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Contact Info */}
                              {(candidate.work_email || candidate.work_phone || candidate.personal_email || candidate.personal_mobile) && (
                                <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
                                  {candidate.personal_mobile && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="h-4 w-4 text-success" />
                                      <span className="text-foreground font-medium">{candidate.personal_mobile}</span>
                                      <Badge className="bg-success/20 text-success text-[10px]">✅ Personal (Enriched)</Badge>
                                    </div>
                                  )}
                                  {candidate.personal_email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="h-4 w-4 text-success" />
                                      <span className="text-foreground">{candidate.personal_email}</span>
                                      <Badge className="bg-success/20 text-success text-[10px]">✅ Personal (Enriched)</Badge>
                                    </div>
                                  )}
                                  {candidate.work_phone && !candidate.personal_mobile && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="h-4 w-4 text-amber-500" />
                                      <span className="text-foreground">{candidate.work_phone}</span>
                                      <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">🏢 Company</Badge>
                                    </div>
                                  )}
                                  {candidate.work_email && !candidate.personal_email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="h-4 w-4 text-amber-500" />
                                      <span className="text-foreground">{candidate.work_email}</span>
                                      <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">🏢 Company</Badge>
                                    </div>
                                  )}
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

        {/* Load More */}
        <div className="flex items-center justify-center gap-4 py-4">
          {hasMore && (
            <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <>Load {BATCH_SIZE} More</>}
            </Button>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={() => navigate("/jobs/new")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Job
          </Button>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleContinue}
            disabled={selectedIds.size === 0}
          >
            Continue with {selectedIds.size} Candidates
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

// Quick Filter Button Component
interface QuickFilterButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  highlight?: "success" | "purple" | "blue" | "green" | "warning";
  description?: string;
}

const QuickFilterButton = ({ active, onClick, icon, label, count, highlight, description }: QuickFilterButtonProps) => {
  const highlightClasses = {
    success: "border-success/50 bg-success/10",
    purple: "border-purple-500/50 bg-purple-500/10",
    blue: "border-blue-500/50 bg-blue-500/10",
    green: "border-green-500/50 bg-green-500/10",
    warning: "border-warning/50 bg-warning/10",
  };
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all min-h-[90px]",
        active 
          ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
          : highlight 
            ? highlightClasses[highlight] 
            : "border-border bg-card hover:bg-secondary/50"
      )}
    >
      <div className={cn(
        "flex items-center gap-2 mb-1",
        active && "text-primary"
      )}>
        {icon}
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground/70 mt-0.5">{description}</span>
      )}
    </button>
  );
};

export default CandidateMatching;
