import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Loader2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Star, Phone, X, Sparkles, Mail, MapPin, Search, Globe,
  Filter, Shield, Zap, Target, Award, Plus, Check
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { OperationProgress } from "@/components/ui/operation-progress";
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
import { ResearchInsights } from "@/components/candidates/ResearchInsights";
import AddCandidatesPanel from "@/components/candidates/AddCandidatesPanel";
import ShortlistBanner from "@/components/candidates/ShortlistBanner";
import ShortlistPanel from "@/components/candidates/ShortlistPanel";
import PoolSection from "@/components/candidates/PoolSection";

// Connection object from personalization engine
interface ConnectionMatch {
  priority: number;
  fact: string;
  benefit: string;
  line: string;
  smsLine: string;
}

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
  match_reasons?: string[];
  from_cache?: boolean;
  researched_at?: string;
  research_depth?: 'quick' | 'deep';
  deep_researched?: boolean;
  personalization_hook?: string;
  hook_type?: string;
  // Profile summary fields from research
  credentials_summary?: string;
  professional_highlights?: string[];
  verified_specialty?: string;
  verified_licenses?: string[];
  imlc_inference_reason?: string;
  research_summary?: string; // From deep research (Perplexity)
  research_confidence?: 'high' | 'medium' | 'low';
  // New rigorous scoring fields
  is_local?: boolean;
  has_job_state_license?: boolean;
  priority_tier?: string;
  // Connection engine fields
  connection?: ConnectionMatch | null;
  sms_hook?: string | null;
}

interface SummaryData {
  total_matched: number;
  returned: number;
  tier_breakdown: {
    a_tier: number;
    b_tier: number;
    c_tier: number;
  };
  priority_breakdown?: {
    top_priority: number;
    high_priority: number;
    local: number;
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

const BATCH_SIZE = 50;

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
  const [deepResearchingIds, setDeepResearchingIds] = useState<Set<string>>(new Set());
  const [autoResearchDone, setAutoResearchDone] = useState(false);
  const [bulkResearching, setBulkResearching] = useState(false);
  const [bulkDeepResearching, setBulkDeepResearching] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  
  // NEW: ATS-style shortlist state
  const [addedToJobIds, setAddedToJobIds] = useState<Set<string>>(new Set());
  const [hideAdded, setHideAdded] = useState(false);

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

  // Research candidates via NPI + AI (with database persistence)
  const researchCandidates = async (candidateIds: string[], skipResearch = false, forceRefresh = false) => {
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
            force_refresh: forceRefresh,
            user_id: user?.id || null,
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
          npi: result.npi_data?.npi || c.npi,
          has_imlc: result.match_analysis?.has_imlc,
          unified_score: result.match_analysis?.grade || c.unified_score,
          match_strength: result.match_analysis?.score || c.match_strength,
          score_reason: result.match_analysis?.reasons?.join(' • ') || c.score_reason,
          icebreaker: result.match_analysis?.icebreaker || c.icebreaker,
          talking_points: result.match_analysis?.talking_points || c.talking_points,
          match_concerns: result.match_analysis?.concerns || [],
          match_reasons: result.match_analysis?.reasons || [],
          from_cache: result.from_cache || false,
          // Profile summary fields from research
          credentials_summary: result.research?.credentials_summary || c.credentials_summary,
          professional_highlights: result.research?.professional_highlights || result.match_analysis?.reasons || c.professional_highlights,
          verified_specialty: result.research?.verified_specialty || c.verified_specialty,
          verified_licenses: result.research?.verified_licenses || c.verified_licenses,
          imlc_inference_reason: result.research?.imlc_inference_reason || c.imlc_inference_reason,
        };
      }));
      
      if (!skipResearch) {
        const cacheMsg = data.cached_count > 0 ? ` (${data.cached_count} from cache)` : '';
        toast.success(`Researched ${data.researched_count} candidates${cacheMsg}`);
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

  // Deep research progress state
  const [deepResearchProgress, setDeepResearchProgress] = useState<{
    current: number;
    total: number;
    currentName?: string;
  } | null>(null);

  // Deep research via Perplexity for personalization hooks - processes in batches with live progress
  const deepResearchCandidates = async (candidateIds: string[], forceRefresh = false) => {
    // Filter out already deep-researched candidates to avoid wasting API calls
    // UNLESS forceRefresh is true, then research all of them
    const candidatesToResearch = forceRefresh 
      ? candidates.filter(c => candidateIds.includes(c.id))
      : candidates.filter(c => candidateIds.includes(c.id) && !c.deep_researched);
    
    if (candidatesToResearch.length === 0) {
      toast.info("All selected candidates already have deep research");
      return;
    }
    
    // Notify user if some were skipped
    const skippedCount = candidateIds.length - candidatesToResearch.length;
    if (skippedCount > 0 && !forceRefresh) {
      toast.info(`Skipping ${skippedCount} already deep-researched candidates`);
    }
    
    setDeepResearchingIds(prev => new Set([...prev, ...candidatesToResearch.map(c => c.id)]));
    setDeepResearchProgress({ current: 0, total: candidatesToResearch.length });
    
    const BATCH_SIZE = 5; // Process 5 at a time
    const batches: Candidate[][] = [];
    
    for (let i = 0; i < candidatesToResearch.length; i += BATCH_SIZE) {
      batches.push(candidatesToResearch.slice(i, i + BATCH_SIZE));
    }
    
    try {
      let processedCount = 0;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchIds = batch.map(c => c.id);
        
        // Update progress with current batch info
        setDeepResearchProgress({
          current: processedCount,
          total: candidatesToResearch.length,
          currentName: batch[0] ? `${batch[0].first_name} ${batch[0].last_name}` : undefined
        });
        
        const response = await fetch(
          "https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/personalization-research",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidate_ids: batchIds,
              job_id: effectiveJobId,
              deep_research: true,
              force_refresh: forceRefresh, // Pass force flag to bypass cache
              batch_size: 3, // Smaller batch for faster parallel Perplexity calls
            }),
          }
        );

        if (!response.ok) {
          console.error(`Batch ${batchIndex + 1} error:`, await response.text());
          // Continue with next batch
          processedCount += batch.length;
          continue;
        }

        const data = await response.json();
        
        // Update candidates with deep research results
        setCandidates(prev => prev.map(c => {
          const result = data.results?.find((r: any) => r.candidate_id === c.id);
          if (!result) return c;
          
          // Only mark as deep_researched if actual research was done (not from cache or icebreaker is substantial)
          const actualDeepResearch = !result.from_cache || 
            (result.icebreaker && result.icebreaker.length > 60) ||
            result.deep_research_done;
          
          return {
            ...c,
            deep_researched: actualDeepResearch || c.deep_researched,
            research_depth: actualDeepResearch ? 'deep' as const : c.research_depth,
            personalization_hook: result.personalization_hook || c.personalization_hook,
            hook_type: result.hook_type || c.hook_type,
            icebreaker: result.icebreaker || c.icebreaker,
            talking_points: result.talking_points || c.talking_points,
            research_summary: result.research_summary || c.research_summary,
            research_confidence: result.confidence || c.research_confidence,
            // Also update profile fields from research data
            professional_highlights: result.professional_highlights || c.professional_highlights,
            credentials_summary: result.credentials_summary || c.credentials_summary,
            has_imlc: result.has_imlc ?? c.has_imlc,
            verified_specialty: result.verified_specialty || c.verified_specialty,
            verified_licenses: result.verified_licenses || c.verified_licenses,
            from_cache: result.from_cache || false,
            // NEW: Save connection engine data for email/SMS generation
            connection: result.connection || c.connection,
            sms_hook: result.sms_hook || c.sms_hook,
          };
        }));
        
        processedCount += data.results?.length || batch.length;
        
        // Update progress
        setDeepResearchProgress({
          current: processedCount,
          total: candidatesToResearch.length,
        });
        
        // Clear completed batch from deepResearchingIds
        setDeepResearchingIds(prev => {
          const next = new Set(prev);
          batchIds.forEach(id => next.delete(id));
          return next;
        });
      }
      
      toast.success(`Deep research complete for ${processedCount} candidates 🔮`);
    } catch (error: any) {
      console.error("Deep research error:", error);
      toast.error(error.message || "Failed to deep research candidates");
    } finally {
      setDeepResearchingIds(new Set());
      setDeepResearchProgress(null);
    }
  };

  // Handle single candidate deep research
  const handleDeepResearchCandidate = (candidate: Candidate, forceRefresh = false) => {
    if (candidate.deep_researched && !forceRefresh) {
      // Already researched - ask if they want to refresh
      toast.info("Already researched - click again to refresh", { duration: 2000 });
      return;
    }
    deepResearchCandidates([candidate.id], forceRefresh);
  };

  // Bulk deep research selected candidates
  const handleBulkDeepResearch = async (forceRefresh = false) => {
    const candidatesToResearch = forceRefresh
      ? candidates.filter(c => selectedIds.has(c.id))
      : candidates.filter(c => selectedIds.has(c.id) && !c.deep_researched);

    if (candidatesToResearch.length === 0) {
      toast.error("No candidates selected for deep research");
      return;
    }

    setBulkDeepResearching(true);
    
    try {
      await deepResearchCandidates(candidatesToResearch.map(c => c.id), forceRefresh);
    } catch (error: any) {
      console.error("Bulk deep research error:", error);
      toast.error(error.message || "Failed to deep research candidates");
    } finally {
      setBulkDeepResearching(false);
    }
  };

  // Count selected candidates needing research
  const selectedNeedingResearch = useMemo(() => 
    candidates.filter(c => selectedIds.has(c.id) && !c.researched).length
  , [candidates, selectedIds]);

  // Count selected candidates eligible for deep research
  const selectedForDeepResearch = useMemo(() => 
    candidates.filter(c => selectedIds.has(c.id) && !c.deep_researched).length
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

  // Pool candidates - optionally hide already added ones
  const poolCandidates = useMemo(() => {
    if (hideAdded) {
      return filteredCandidates.filter(c => !addedToJobIds.has(c.id));
    }
    return filteredCandidates;
  }, [filteredCandidates, hideAdded, addedToJobIds]);

  // Sorted candidates - now uses poolCandidates instead of filteredCandidates
  const sortedCandidates = useMemo(() => {
    const sorted = [...poolCandidates];
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
  }, [poolCandidates, sortBy, jobState]);

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

  // NEW: Add to Job handlers
  const handleAddToJob = (candidateId: string) => {
    setAddedToJobIds(prev => new Set(prev).add(candidateId));
    toast.success("Added to campaign shortlist");
  };

  const handleRemoveFromJob = (candidateId: string) => {
    setAddedToJobIds(prev => {
      const next = new Set(prev);
      next.delete(candidateId);
      return next;
    });
    toast.info("Removed from shortlist");
  };

  const handleClearShortlist = () => {
    setAddedToJobIds(new Set());
    toast.info("Shortlist cleared");
  };

  const handleAddAllVisible = () => {
    const visibleIds = sortedCandidates.map(c => c.id);
    setAddedToJobIds(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => next.add(id));
      return next;
    });
    // P0: Auto-enable hide toggle after bulk add
    setHideAdded(true);
    toast.success(`Added ${visibleIds.length} candidates to shortlist`, {
      description: "Added candidates are now hidden from pool",
      action: {
        label: "Undo",
        onClick: () => {
          setAddedToJobIds(prev => {
            const next = new Set(prev);
            visibleIds.forEach(id => next.delete(id));
            return next;
          });
          setHideAdded(false);
        }
      }
    });
  };

  // P1: Add selected candidates to job shortlist
  const handleAddSelectedToJob = () => {
    const newIds = Array.from(selectedIds);
    setAddedToJobIds(prev => {
      const next = new Set(prev);
      newIds.forEach(id => next.add(id));
      return next;
    });
    setSelectedIds(new Set());
    toast.success(`Added ${newIds.length} candidates to shortlist`);
  };

  // P1: Research all unresearched candidates
  const handleResearchAll = () => {
    const unresearchedIds = candidates.filter(c => !c.researched).map(c => c.id);
    if (unresearchedIds.length === 0) {
      toast.info("All candidates are already researched");
      return;
    }
    researchCandidates(unresearchedIds, false, false);
  };

  // P1: Counts for stats bar
  const researchedCount = useMemo(() => 
    candidates.filter(c => c.researched).length
  , [candidates]);
  
  const unresearchedCount = useMemo(() => 
    candidates.filter(c => !c.researched).length
  , [candidates]);

  // NEW: Split pool into Local vs Other candidates for split-view sections
  const localPoolCandidates = useMemo(() => 
    sortedCandidates.filter(c => c.state === jobState),
  [sortedCandidates, jobState]);

  const otherPoolCandidates = useMemo(() => 
    sortedCandidates.filter(c => c.state !== jobState),
  [sortedCandidates, jobState]);

  // NEW: Section-level bulk add handlers
  const handleAddAllLocal = () => {
    const localIds = localPoolCandidates.map(c => c.id);
    if (localIds.length === 0) {
      toast.info("No local candidates to add");
      return;
    }
    setAddedToJobIds(prev => new Set([...prev, ...localIds]));
    setHideAdded(true);
    toast.success(`Added ${localIds.length} local candidates to shortlist`);
  };

  const handleAddAllOther = () => {
    const otherIds = otherPoolCandidates.map(c => c.id);
    if (otherIds.length === 0) {
      toast.info("No other candidates to add");
      return;
    }
    setAddedToJobIds(prev => new Set([...prev, ...otherIds]));
    setHideAdded(true);
    toast.success(`Added ${otherIds.length} candidates to shortlist`);
  };

  const handleContinue = () => {
    // Use addedToJobIds instead of selectedIds for the campaign flow
    const addedCandidates = candidates.filter(c => addedToJobIds.has(c.id));
    
    if (addedCandidates.length === 0) {
      toast.error("Please add candidates to your shortlist first");
      return;
    }
    
    // Save all required keys for the campaign builder workflow
    sessionStorage.setItem("selectedCandidates", JSON.stringify(addedCandidates));
    sessionStorage.setItem("campaign_candidates", JSON.stringify(addedCandidates));
    sessionStorage.setItem("campaign_candidate_ids", JSON.stringify(Array.from(addedToJobIds)));
    
    // Save job data with required keys
    if (effectiveJobId) {
      sessionStorage.setItem("campaign_job_id", effectiveJobId);
      if (job) {
        sessionStorage.setItem("campaign_job", JSON.stringify({
          id: effectiveJobId,
          job_name: job.specialty,
          facility_name: job.facility,
          city: job.location?.split(',')[0]?.trim() || null,
          state: job.state,
          specialty: job.specialty,
          bill_rate: job.billRate,
        }));
        sessionStorage.setItem("job", JSON.stringify(job));
      }
    }
    
    navigate("/campaigns/new/personalize");
  };

  // Handler to merge new candidates from the AddCandidatesPanel
  const handleAddCandidates = (newCandidates: Candidate[]) => {
    // Merge new candidates with existing list (avoid duplicates)
    const existingIds = new Set(candidates.map(c => c.id));
    const uniqueNew = newCandidates.filter(c => !existingIds.has(c.id));
    
    if (uniqueNew.length === 0) {
      toast.info("All selected candidates are already in your list");
      setAddPanelOpen(false);
      return;
    }
    
    setCandidates(prev => [...prev, ...uniqueNew]);
    
    // Auto-select the newly added candidates
    setSelectedIds(prev => {
      const next = new Set(prev);
      uniqueNew.forEach(c => next.add(c.id));
      return next;
    });
    
    toast.success(`Added ${uniqueNew.length} candidate${uniqueNew.length !== 1 ? 's' : ''} to your selection`);
    setAddPanelOpen(false);
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
    <Layout currentStep={2} showSteps={false}>
      {/* Sticky Job Summary Header */}
      <div className="sticky top-14 z-40 -mx-6 px-6 py-3 bg-gradient-to-r from-primary/10 to-purple-500/10 border-b border-primary/20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {job?.specialty || "IR"} at {job?.facility || "Facility"}
            </h1>
            <p className="text-sm text-muted-foreground">{job?.location || "Location"} • <span className="text-success font-semibold">${job?.payRate || 0}/hr</span></p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {summary?.ai_scored && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                AI Scored
              </div>
            )}
            <div className="text-center">
              <p className="text-xl font-bold text-cyan-400">{researchedCount}/{candidates.length}</p>
              <p className="text-[10px] text-muted-foreground">Researched</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-success">{filterCounts.contact_ready}</p>
              <p className="text-[10px] text-muted-foreground">Contact Ready</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-blue-400">{filterCounts.local}</p>
              <p className="text-[10px] text-muted-foreground">Local ({jobState})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-10rem)] mt-4">
        {/* Left: Shortlist Panel - Sticky on desktop */}
        <div className="w-full lg:w-[380px] lg:shrink-0">
          <div className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-hidden">
            <ShortlistPanel
              candidates={candidates}
              addedIds={addedToJobIds}
              jobState={jobState}
              onRemove={handleRemoveFromJob}
              onClear={handleClearShortlist}
              onContinue={handleContinue}
              disabled={addedToJobIds.size === 0}
            />
          </div>
        </div>
        
        {/* Right: Candidate Pool */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Active Operations Progress Bars */}
          {(researchingIds.size > 0 || deepResearchingIds.size > 0 || bulkResearching || bulkDeepResearching || searchingAlphaSophia || bulkEnriching) && (
            <div className="space-y-2">
              <OperationProgress
                isActive={researchingIds.size > 0 || bulkResearching}
                label={`Researching ${researchingIds.size} candidate${researchingIds.size !== 1 ? 's' : ''} (NPI + AI scoring)`}
                current={candidates.filter(c => c.researched).length}
                total={candidates.filter(c => c.researched).length + researchingIds.size}
              />
              <OperationProgress
                isActive={deepResearchingIds.size > 0 || bulkDeepResearching}
                label={deepResearchProgress 
                  ? `🔮 Deep researching ${deepResearchProgress.currentName ? `"${deepResearchProgress.currentName}"` : ''} (${deepResearchProgress.current}/${deepResearchProgress.total})`
                  : `🔮 Deep researching ${deepResearchingIds.size} candidate${deepResearchingIds.size !== 1 ? 's' : ''}`
                }
                current={deepResearchProgress?.current}
                total={deepResearchProgress?.total}
              />
              <OperationProgress
                isActive={searchingAlphaSophia}
                label="Searching Alpha Sophia for additional candidates..."
              />
              <OperationProgress
                isActive={bulkEnriching}
                label="Adding candidates to enrichment queue..."
              />
            </div>
          )}

          {/* Quick Filters */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <QuickFilterButton 
              active={quickFilter === "all"} 
              onClick={() => setQuickFilter("all")}
              icon={<Users className="h-4 w-4" />}
              label="All"
              count={filterCounts.all}
            />
            <QuickFilterButton 
              active={quickFilter === "local"} 
              onClick={() => setQuickFilter("local")}
              icon={<MapPin className="h-4 w-4" />}
              label={`Local (${jobState})`}
              count={filterCounts.local}
              highlight="green"
            />
            <QuickFilterButton 
              active={quickFilter === "contact_ready"} 
              onClick={() => setQuickFilter("contact_ready")}
              icon={<Phone className="h-4 w-4" />}
              label="Contact Ready"
              count={filterCounts.contact_ready}
              highlight="success"
            />
            <QuickFilterButton 
              active={quickFilter === "10_plus_licenses"} 
              onClick={() => setQuickFilter("10_plus_licenses")}
              icon={<Award className="h-4 w-4" />}
              label="10+ Licenses"
              count={filterCounts["10_plus_licenses"]}
              highlight="purple"
            />
            <QuickFilterButton 
              active={quickFilter === "enriched_personal"} 
              onClick={() => setQuickFilter("enriched_personal")}
              icon={<Sparkles className="h-4 w-4" />}
              label="Enriched"
              count={filterCounts.enriched_personal}
              highlight="blue"
            />
            <QuickFilterButton 
              active={quickFilter === "needs_enrichment"} 
              onClick={() => setQuickFilter("needs_enrichment")}
              icon={<Search className="h-4 w-4" />}
              label="Needs Enrich"
              count={filterCounts.needs_enrichment}
              highlight="warning"
            />
          </div>

          {/* Search & Sort Bar */}
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
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enriched_first">✅ Enriched First</SelectItem>
                <SelectItem value="contact_first">📞 Contact First</SelectItem>
                <SelectItem value="best_match">🎯 Best Match</SelectItem>
                <SelectItem value="most_licenses">🏆 Most Licenses</SelectItem>
                <SelectItem value="local_first">📍 Local First</SelectItem>
                <SelectItem value="score">⭐ Score</SelectItem>
              </SelectContent>
            </Select>

            {/* Hide Added Toggle */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
              addedToJobIds.size > 0 && "bg-success/10 border border-success/30"
            )}>
              <Checkbox
                id="hideAdded"
                checked={hideAdded}
                onCheckedChange={(checked) => setHideAdded(!!checked)}
              />
              <label 
                htmlFor="hideAdded" 
                className={cn(
                  "text-sm cursor-pointer",
                  addedToJobIds.size > 0 ? "text-success font-medium" : "text-muted-foreground"
                )}
              >
                {addedToJobIds.size > 0 ? `Hide ${addedToJobIds.size} added` : "Hide added (0)"}
              </label>
            </div>

            {/* Research All Button */}
            {unresearchedCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResearchAll}
                disabled={bulkResearching || researchingIds.size > 0}
                className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/20"
              >
                <Target className="h-4 w-4 mr-1" />
                Research All ({unresearchedCount})
              </Button>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {sortedCandidates.length} of {candidates.length} loaded ({totalCount} total)
              {quickFilter !== "all" && ` • Filtered: ${quickFilter.replace(/_/g, ' ')}`}
              {hideAdded && addedToJobIds.size > 0 && ` • ${addedToJobIds.size} hidden`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddPanelOpen(true)}
                className="border-muted-foreground/30"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add More
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={searchAlphaSophia}
                disabled={searchingAlphaSophia || (alphaSophiaLimit && !alphaSophiaLimit.allowed)}
                className={alphaSophiaSearched ? "border-blue-500/30 text-blue-400" : "bg-blue-600 hover:bg-blue-700 text-white border-0"}
              >
                {searchingAlphaSophia ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Globe className="h-4 w-4 mr-1" />}
                {alphaSophiaSearched ? "Alpha Sophia" : "Search Alpha Sophia"}
              </Button>
            </div>
          </div>

          {/* LOCAL CANDIDATES SECTION */}
          <PoolSection
            title="Local Candidates"
            subtitle="In job state - faster credentialing, no relocation"
            candidates={localPoolCandidates}
            highlight="green"
            addedIds={addedToJobIds}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            onAdd={handleAddToJob}
            onRemove={handleRemoveFromJob}
            onAddAll={handleAddAllLocal}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
            onResearch={handleResearchCandidate}
            onDeepResearch={handleDeepResearchCandidate}
            onEnrich={handleEnrichCandidate}
            researchingIds={researchingIds}
            deepResearchingIds={deepResearchingIds}
            enrichingIds={enrichingIds}
            jobState={jobState}
            job={job ? { specialty: job.specialty, state: job.state, payRate: job.payRate } : undefined}
          />

          {/* OTHER CANDIDATES SECTION */}
          <PoolSection
            title="Other Candidates"
            subtitle="Out-of-state candidates with matching qualifications"
            candidates={otherPoolCandidates}
            addedIds={addedToJobIds}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            onAdd={handleAddToJob}
            onRemove={handleRemoveFromJob}
            onAddAll={handleAddAllOther}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
            onResearch={handleResearchCandidate}
            onDeepResearch={handleDeepResearchCandidate}
            onEnrich={handleEnrichCandidate}
            researchingIds={researchingIds}
            deepResearchingIds={deepResearchingIds}
            enrichingIds={enrichingIds}
            jobState={jobState}
            job={job ? { specialty: job.specialty, state: job.state, payRate: job.payRate } : undefined}
          />

          {/* Load More */}
          {hasMore && (
            <div className="flex flex-col items-center justify-center gap-2 py-4">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                ) : (
                  <>Load More ({Math.min(BATCH_SIZE, totalCount - candidates.length)} remaining)</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {candidates.length} of {totalCount} total matches
              </p>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => navigate("/jobs/new")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Job
            </Button>
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={addedToJobIds.size === 0}
              className={cn(
                addedToJobIds.size > 0 && "animate-pulse-glow"
              )}
            >
              Continue with {addedToJobIds.size} Candidates
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* P1: Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-6 py-3 bg-card border border-border rounded-2xl shadow-2xl shadow-black/50">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="h-6 w-px bg-border" />
            
            {selectedNeedingResearch > 0 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleBulkResearch}
                disabled={bulkResearching}
                className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/20"
              >
                <Target className="h-4 w-4 mr-1" />
                Research ({selectedNeedingResearch})
              </Button>
            )}
            
            {selectedForDeepResearch > 0 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkDeepResearch(false)}
                disabled={bulkDeepResearching}
                className="bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20"
              >
                <span className="mr-1">🔮</span>
                Deep ({selectedForDeepResearch})
              </Button>
            )}
            
            <Button 
              size="sm" 
              onClick={handleAddSelectedToJob}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to Job
            </Button>
            
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add More Candidates Panel */}
      <AddCandidatesPanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        jobId={effectiveJobId}
        jobState={jobState}
        specialty={job?.specialty || ""}
        existingCandidateIds={new Set(candidates.map(c => c.id))}
        onAddCandidates={handleAddCandidates}
      />
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
