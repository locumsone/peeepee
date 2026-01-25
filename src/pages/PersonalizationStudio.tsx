import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Sparkles, RefreshCw, Edit2, Check, X,
  Users, Target, Search, CheckCircle2, AlertTriangle, Lightbulb, Cat,
  FileText, ExternalLink, Mail, MessageSquare, Eye, Copy, BookOpen,
  DollarSign, MapPin, Phone, Calendar, ChevronDown, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaybookCacheCard, StructuredPlaybookCache } from "@/components/playbook/PlaybookCacheCard";
import { useUserSignature } from "@/hooks/useUserSignature";
import { MessageRefiner } from "@/components/personalization/MessageRefiner";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Personalize" },
  { number: 4, label: "Sequence" },
  { number: 5, label: "Review" },
];

interface Job {
  id: string;
  job_name?: string;
  facility_name?: string;
  specialty?: string;
  city?: string;
  state?: string;
  bill_rate?: number;
  pay_rate?: number;
}

// Connection object from personalization-research engine
interface ConnectionMatch {
  priority: number;      // 1-8, lower = stronger
  fact: string;          // What we found about candidate
  benefit: string;       // Why this role fits them
  line: string;          // Full connection sentence for email
  smsLine: string;       // Compressed 40-char version for SMS
}

interface Candidate {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  personal_mobile?: string;
  licenses?: string[];
  tier?: string;
  // Personalization fields
  personalization_hook?: string;
  hook_type?: string;
  icebreaker?: string;
  talking_points?: string[];
  deep_researched?: boolean;
  research_confidence?: string;
  // Connection from personalization engine
  connection?: ConnectionMatch | null;
  // Full message drafts
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
}

interface NotionPlaybook {
  id: string;
  title: string;
  url: string;
  summary?: string;
  fullContent?: string; // Full Notion page content when fetched
}

// Legacy interface for backwards compatibility
interface LegacyPlaybookCache {
  notion_id: string;
  title: string;
  content: string;
  extracted_rates: {
    hourly?: string;
    daily?: string;
    weekly?: string;
    annual?: string;
    call_status?: string;
    procedures?: string;
  };
  synced_at: string;
}

// Type guard to check if cache is structured or legacy
function isStructuredCache(cache: any): cache is StructuredPlaybookCache {
  return cache && typeof cache.compensation === 'object' && typeof cache.positioning === 'object';
}

export default function PersonalizationStudio() {
  const navigate = useNavigate();
  const { getSignatureData, hasSignature } = useUserSignature();
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  
  // Playbook state
  const [playbookSearch, setPlaybookSearch] = useState("");
  const [isSearchingPlaybooks, setIsSearchingPlaybooks] = useState(false);
  const [notionPlaybooks, setNotionPlaybooks] = useState<NotionPlaybook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<NotionPlaybook | null>(null);
  const [playbookContent, setPlaybookContent] = useState<string>("");
  const [isLoadingPlaybook, setIsLoadingPlaybook] = useState(false);
  const [cachedPlaybook, setCachedPlaybook] = useState<StructuredPlaybookCache | LegacyPlaybookCache | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  
  // Preview state
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<string>("email");
  
  // Editing state - now using AI refiner
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editingField, setEditingField] = useState<'email' | 'sms' | null>(null);
  const [showRefiner, setShowRefiner] = useState(false);
  
  // Compute pay rate
  const payRate = useMemo(() => {
    if (job?.pay_rate) return job.pay_rate;
    if (job?.bill_rate) return Math.round(job.bill_rate * 0.8);
    return 500;
  }, [job]);
  
  // Load data
  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates") || sessionStorage.getItem("selectedCandidates");
    const storedJob = sessionStorage.getItem("campaign_job");
    const storedCampaignId = sessionStorage.getItem("campaign_id");
    
    if (!storedJobId || !storedCandidates) {
      toast.error("Missing campaign data");
      navigate("/campaigns/new");
      return;
    }
    
    setJobId(storedJobId);
    if (storedCampaignId) setCampaignId(storedCampaignId);
    
    try {
      const parsed = JSON.parse(storedCandidates);
      setCandidates(parsed);
      setGeneratedCount(parsed.filter((c: Candidate) => c.email_body).length);
    } catch (e) {
      console.error("Error parsing candidates:", e);
    }
    
    if (storedJob) {
      try {
        setJob(JSON.parse(storedJob));
      } catch (e) {
        console.error("Error parsing job:", e);
      }
    }
    
    // Fetch fresh job data and campaign playbook
    const fetchData = async () => {
      // Get job
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", storedJobId)
        .single();
      
      if (jobData) {
        setJob(jobData);
        sessionStorage.setItem("campaign_job", JSON.stringify(jobData));
      }
      
      // Check for existing campaign with cached playbook
      if (storedCampaignId) {
        const { data: campaignData } = await supabase
          .from("campaigns")
          .select("playbook_data, playbook_notion_id, playbook_synced_at")
          .eq("id", storedCampaignId)
          .maybeSingle();
        
        if (campaignData?.playbook_data) {
          const cached = campaignData.playbook_data as unknown as StructuredPlaybookCache | LegacyPlaybookCache;
          setCachedPlaybook(cached);
          
          // Handle both structured and legacy cache formats
          if (isStructuredCache(cached)) {
            // New structured format - no raw content stored
            setSelectedPlaybook({
              id: cached.notion_id,
              title: cached.title,
              url: cached.notion_url || `https://notion.so/${cached.notion_id}`,
            });
            toast.success(`Loaded structured playbook: ${cached.title}`);
            console.log("=== STRUCTURED PLAYBOOK CACHE LOADED ===");
            console.log("Compensation:", cached.compensation);
            console.log("Clinical:", cached.clinical);
          } else {
            // Legacy format with raw content
            setPlaybookContent((cached as LegacyPlaybookCache).content || "");
            setSelectedPlaybook({
              id: cached.notion_id,
              title: cached.title,
              url: `https://notion.so/${cached.notion_id}`,
            });
            toast.success(`Loaded legacy cache: ${cached.title}`);
            console.log("=== LEGACY PLAYBOOK CACHE LOADED ===");
          }
        }
      }
    };
    fetchData();
  }, [navigate]);
  
  // Extract rates from playbook content
  const extractRatesFromContent = (content: string) => {
    const hourlyMatch = content.match(/\$(\d{2,4})(?:\.00)?(?:\s*)?(?:\/\s*hour|\/hour|\/hr|per hour)/i)
      || content.match(/Hourly Rate:\*?\*?\s*\$(\d{2,4})/i);
    const dailyMatch = content.match(/Daily (?:Rate|Earnings):\*?\*?\s*\$([\d,]+)/i)
      || content.match(/\$([\d,]+)(?:\s*)?(?:\/\s*day|\/day|per day)/i);
    const weeklyMatch = content.match(/Weekly (?:Rate|Earnings):\*?\*?\s*\$([\d,]+)/i)
      || content.match(/\$([\d,]+)(?:\s*)?(?:\/\s*week|\/week|per week)/i);
    const annualMatch = content.match(/Annual Potential:\*?\*?\s*\$([\d,]+)/i)
      || content.match(/\$([\d,]+,000)\s*(?:annual|annually|per year)/i);
    const callMatch = content.match(/On-Call:\*?\*?\s*(NO|None|Zero|YES)/i)
      || content.match(/(Zero call|NO CALL|no on-?call)/i);
    const proceduresMatch = content.match(/(?:Procedures?|Scope|Case Types?).*?:([\s\S]*?)(?=\n\*\*|\n##|$)/i);

    return {
      hourly: hourlyMatch ? hourlyMatch[1] : undefined,
      daily: dailyMatch ? dailyMatch[1].replace(',', '') : undefined,
      weekly: weeklyMatch ? weeklyMatch[1].replace(',', '') : undefined,
      annual: annualMatch ? annualMatch[1] : undefined,
      call_status: callMatch ? callMatch[0] : undefined,
      procedures: proceduresMatch ? proceduresMatch[1].trim().substring(0, 200) : undefined,
    };
  };
  
  // Save playbook to campaign using NEW structured cache via edge function
  const savePlaybookToCampaign = async (notionId: string, title: string, content: string) => {
    if (!campaignId) {
      console.log("No campaign ID - playbook will only be stored in session");
      return;
    }
    
    try {
      // Call edge function to parse content into structured cache
      const { data, error } = await supabase.functions.invoke('fetch-notion-playbook', {
        body: { 
          page_id: notionId,
          campaign_id: campaignId,
          raw_content: content, // Send raw content to be parsed
        },
      });
      
      if (error) throw error;
      
      if (data?.structured_cache) {
        setCachedPlaybook(data.structured_cache);
        const rate = data.structured_cache.compensation?.hourly || 'not found';
        toast.success(`Playbook cached with ${rate} rate (${data.cache_size} chars)`);
        console.log("=== STRUCTURED PLAYBOOK SAVED ===");
        console.log("Cache size:", data.cache_size, "chars (limit: 5000)");
        console.log("Validation:", data.validation);
      } else {
        // Fallback: Save legacy format
        const extractedRates = extractRatesFromContent(content);
        const legacyCache: LegacyPlaybookCache = {
          notion_id: notionId,
          title,
          content: content.substring(0, 4500), // Truncate if needed
          extracted_rates: extractedRates,
          synced_at: new Date().toISOString(),
        };
        
        await supabase
          .from("campaigns")
          .update({
            playbook_data: JSON.parse(JSON.stringify(legacyCache)),
            playbook_notion_id: notionId,
            playbook_synced_at: new Date().toISOString(),
          })
          .eq("id", campaignId);
        
        setCachedPlaybook(legacyCache);
        toast.success(`Playbook cached (legacy) with $${extractedRates.hourly}/hr rate`);
      }
    } catch (error) {
      console.error("Failed to save playbook to campaign:", error);
      toast.error("Failed to cache playbook - saved raw content");
    }
  };
  
  // Sync playbook from Notion (refresh cache) - ACTUAL FETCH via Notion MCP
  const handleSyncPlaybook = async () => {
    if (!cachedPlaybook?.notion_id) {
      toast.error("No playbook to sync - select one first");
      return;
    }
    
    setIsSyncing(true);
    toast.info("Fetching latest playbook from Notion...");
    
    try {
      // Use the Supabase edge function to fetch from Notion
      const { data, error } = await supabase.functions.invoke('fetch-notion-playbook', {
        body: { 
          page_id: cachedPlaybook.notion_id,
          campaign_id: campaignId
        },
      });
      
      if (error) throw error;
      
      if (data?.content && data.content.length > 500) {
        // Use structured parsing via edge function
        const { data: parseData } = await supabase.functions.invoke('fetch-notion-playbook', {
          body: { 
            page_id: cachedPlaybook.notion_id,
            campaign_id: campaignId,
            raw_content: data.content,
          },
        });
        
        if (parseData?.structured_cache) {
          setCachedPlaybook(parseData.structured_cache);
          toast.success(`Synced! Rate: ${parseData.structured_cache.compensation?.hourly || 'not found'}`);
        }
      } else {
        throw new Error("Empty or invalid content received");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Sync failed - try pasting content manually or ask agent to fetch");
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Search Notion for playbooks via edge function
  // Falls back to showing guidance if edge function fails (due to API key scope)
  const handleSearchNotionPlaybooks = async () => {
    const searchTerm = playbookSearch.trim();
    
    if (!searchTerm) {
      toast.error("Enter a playbook name to search (e.g., 'Lakewood', 'IR', 'GI')");
      return;
    }
    
    // Check if user pasted a Notion URL - extract ID and load directly
    const notionUrlMatch = searchTerm.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9]{32}|[a-f0-9-]{36})/i);
    if (notionUrlMatch) {
      const pageId = notionUrlMatch[1];
      toast.info("Notion URL detected! Loading playbook...");
      
      // Create a playbook entry and try to load it
      const playbook: NotionPlaybook = {
        id: pageId,
        title: "Loading from Notion...",
        url: searchTerm,
      };
      setSelectedPlaybook(playbook);
      handleSelectPlaybook(playbook);
      return;
    }
    
    setIsSearchingPlaybooks(true);
    setNotionPlaybooks([]); // Clear previous results
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to search Notion");
        return;
      }
      
      const response = await supabase.functions.invoke("fetch-notion-playbook", {
        body: { search_query: searchTerm },
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Search failed");
      }
      
      const { results, count } = response.data || { results: [], count: 0 };
      
      const playbooks: NotionPlaybook[] = (results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        url: r.url,
      }));
      
      setNotionPlaybooks(playbooks);
      
      if (playbooks.length > 0) {
        toast.success(`Found ${count} playbooks matching "${searchTerm}"`);
      } else {
        // Edge function didn't find results - likely API key scope issue
        // Guide user to paste a Notion URL instead
        toast.warning(`No results via API. Try pasting a Notion page URL directly (e.g., https://notion.so/your-playbook-page)`);
      }
    } catch (error: any) {
      console.error("Notion search error:", error);
      // On any error, guide user to paste URL
      toast.warning("Search unavailable. Paste a Notion page URL directly to load your playbook.");
    } finally {
      setIsSearchingPlaybooks(false);
    }
  };
  
  // Load selected playbook content - now expects REAL Notion content
  // The full playbook content should be passed from the Notion MCP fetch
  const handleSelectPlaybook = async (playbook: NotionPlaybook) => {
    setSelectedPlaybook(playbook);
    setIsLoadingPlaybook(true);
    
    try {
      // If playbook already has full content (from Notion MCP), use it
      if (playbook.fullContent && playbook.fullContent.length > 1000) {
        setPlaybookContent(playbook.fullContent);
        toast.success(`Playbook loaded (${playbook.fullContent.length.toLocaleString()} chars)`);
        console.log("PLAYBOOK LOADED - Content length:", playbook.fullContent.length);
        console.log("PLAYBOOK SAMPLE (first 500 chars):", playbook.fullContent.substring(0, 500));
        
        // Validate it contains rate information
        const hourlyMatch = playbook.fullContent.match(/\$(\d{2,4})(?:\.00)?(?:\s*)?(?:\/\s*hour|\/hour|\/hr|per hour)/i);
        if (hourlyMatch) {
          console.log("✅ RATE FOUND IN PLAYBOOK:", hourlyMatch[0]);
        } else {
          console.warn("⚠️ No hourly rate found in playbook content - extraction may fail");
        }
        
        // Save to campaign cache
        await savePlaybookToCampaign(playbook.id, playbook.title, playbook.fullContent);
      } else {
        // Try fetching via edge function first
        try {
          const { data, error } = await supabase.functions.invoke('fetch-notion-playbook', {
            body: { page_id: playbook.id, campaign_id: campaignId },
          });
          
          // Check for new structured_cache response format
          if (!error && data?.structured_cache) {
            setCachedPlaybook(data.structured_cache);
            const rate = data.structured_cache.compensation?.hourly || data.structured_cache.compensation?.salary_range || 'check cache';
            toast.success(`Playbook synced! Rate: ${rate}`);
            setPlaybookContent(`Playbook cached successfully. See structured data in sidebar.`);
          } else if (!error && data?.content && data.content.length > 500) {
            // Legacy: raw content response
            setPlaybookContent(data.content);
            toast.success(`Playbook loaded (${data.content.length.toLocaleString()} chars)`);
            await savePlaybookToCampaign(playbook.id, playbook.title, data.content);
          } else {
            throw new Error(data?.error || "Edge function didn't return content");
          }
        } catch (fetchError: any) {
          // Edge function failed (likely 404 - page not shared with integration)
          // Show helpful guidance with the page ID for the agent to fetch via MCP
          console.log("Edge function failed, using fallback:", fetchError);
          toast.info(`Playbook selected! Say: "Load playbook ${playbook.id}" and I'll fetch it via Notion.`);
          setPlaybookContent(`# ${playbook.title}\n\n**The Notion API key doesn't have access to this page.**\n\nTo load this playbook, ask the agent:\n> "Load playbook from Notion page ${playbook.id}"\n\nThe agent has MCP access to Notion and can fetch it for you.`);
        }
      }
    } catch (error) {
      console.error("Playbook load error:", error);
      toast.error("Failed to load playbook");
    } finally {
      setIsLoadingPlaybook(false);
    }
  };
  
  // Function to receive full Notion content from agent
  // This is called when the agent fetches the playbook via MCP
  const setNotionPlaybookContent = async (content: string, playbookId?: string) => {
    if (!content || content.length < 100) {
      toast.error("Playbook content too short - ensure full document is fetched");
      return;
    }
    
    setPlaybookContent(content);
    setIsSyncing(false);
    
    // Log for validation
    console.log("=== NOTION PLAYBOOK RECEIVED ===");
    console.log("Content length:", content.length, "characters");
    
    // Extract and validate key data
    const hourlyMatch = content.match(/\$(\d{2,4})(?:\.00)?(?:\s*)?(?:\/\s*hour|\/hour|\/hr|per hour)/i)
      || content.match(/Hourly Rate:\*?\*?\s*\$(\d{2,4})/i);
    const dailyMatch = content.match(/Daily (?:Rate|Earnings):\*?\*?\s*\$([\d,]+)/i)
      || content.match(/\$([\d,]+)(?:\s*)?(?:\/\s*day|\/day|per day)/i);
    const callMatch = content.match(/On-Call:\*?\*?\s*(NO|None|Zero|YES)/i)
      || content.match(/(Zero call|NO CALL|no on-?call)/i);
    
    console.log("EXTRACTED VALUES:");
    console.log("- Hourly:", hourlyMatch ? `$${hourlyMatch[1]}` : "NOT FOUND");
    console.log("- Daily:", dailyMatch ? dailyMatch[1] : "NOT FOUND");
    console.log("- Call:", callMatch ? callMatch[0] : "NOT FOUND");
    
    if (hourlyMatch) {
      toast.success(`Playbook loaded with $${hourlyMatch[1]}/hr rate`);
    } else {
      toast.warning("Playbook loaded but hourly rate not detected - verify content");
    }
    
    // Save to campaign cache
    const notionId = playbookId || selectedPlaybook?.id || cachedPlaybook?.notion_id;
    const title = selectedPlaybook?.title || cachedPlaybook?.title || "Recruitment Playbook";
    
    if (notionId) {
      await savePlaybookToCampaign(notionId, title, content);
    }
  };
  
  // Expose function globally for agent interaction (temporary bridge)
  useEffect(() => {
    (window as any).setNotionPlaybookContent = setNotionPlaybookContent;
    return () => {
      delete (window as any).setNotionPlaybookContent;
    };
  }, []);
  
  // Generate full personalized emails/SMS for all candidates
  const handleGenerateAll = async () => {
    if (!selectedPlaybook && !playbookContent) {
      toast.error("Select a playbook first");
      return;
    }
    
    if (candidates.length === 0) {
      toast.error("No candidates to personalize");
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    const candidatesToProcess = candidates.filter(c => !c.email_body);
    let processed = 0;
    
    // Build playbook_data ONCE before the loop
    let playbookDataToSend: any = null;
    if (cachedPlaybook) {
      if (isStructuredCache(cachedPlaybook)) {
        playbookDataToSend = cachedPlaybook;
      } else {
        // Convert legacy cache to a format the edge function can use
        const legacy = cachedPlaybook as LegacyPlaybookCache;
        playbookDataToSend = {
          notion_id: legacy.notion_id,
          title: legacy.title,
          compensation: {
            hourly: legacy.extracted_rates?.hourly ? `$${legacy.extracted_rates.hourly}` : undefined,
            daily: legacy.extracted_rates?.daily,
            weekly: legacy.extracted_rates?.weekly,
            annual: legacy.extracted_rates?.annual,
          },
          clinical: {
            call_status: legacy.extracted_rates?.call_status,
            procedures: legacy.extracted_rates?.procedures,
          },
          raw_content: legacy.content,
        };
      }
    }
    
    // Store fetched connections in a local Map for immediate access (state updates are async)
    const connectionMap = new Map<string, { connection: ConnectionMatch | null; personalization_hook?: string; talking_points?: string[] }>();
    
    try {
      // ========== STEP 1: FETCH CONNECTIONS FOR ALL CANDIDATES ==========
      // This ensures the connection engine runs BEFORE email generation
      const candidatesNeedingConnection = candidatesToProcess.filter(c => !c.connection);
      
      if (candidatesNeedingConnection.length > 0) {
        console.log(`🔗 Fetching connections for ${candidatesNeedingConnection.length} candidates...`);
        toast.info(`Analyzing ${candidatesNeedingConnection.length} candidates for personalization...`);
        
        try {
          const { data: researchData, error: researchError } = await supabase.functions.invoke('personalization-research', {
            body: {
              candidate_ids: candidatesNeedingConnection.map(c => c.id),
              job_id: jobId,
              deep_research: false, // Quick connection check only
              playbook_data: playbookDataToSend,
            },
          });
          
          if (researchError) {
            console.error("Connection fetch error:", researchError);
          } else if (researchData?.results) {
            console.log(`✅ Received ${researchData.results.length} connection results`);
            
            // Store connections in local Map for immediate use
            researchData.results.forEach((result: any) => {
              if (result.connection) {
                console.log(`   🎯 ${result.candidate_name || result.candidate_id}: P${result.connection.priority} - "${result.connection.line?.substring(0, 50)}..."`);
              } else {
                console.log(`   ⚠️ ${result.candidate_name || result.candidate_id}: No connection found`);
              }
              
              connectionMap.set(result.candidate_id, {
                connection: result.connection || null,
                personalization_hook: result.personalization_hook,
                talking_points: result.talking_points,
              });
            });
            
            // Also update state for UI/future use
            setCandidates(prev => prev.map(c => {
              const result = connectionMap.get(c.id);
              if (!result) return c;
              return {
                ...c,
                connection: result.connection,
                personalization_hook: result.personalization_hook || c.personalization_hook,
                talking_points: result.talking_points || c.talking_points,
              };
            }));
          }
        } catch (connError) {
          console.error("Connection research failed:", connError);
          // Continue with email generation even if connection fetch fails
        }
      } else {
        console.log(`✅ All ${candidatesToProcess.length} candidates already have connections`);
        // Populate connectionMap from existing candidates
        candidatesToProcess.forEach(c => {
          if (c.connection) {
            connectionMap.set(c.id, {
              connection: c.connection,
              personalization_hook: c.personalization_hook,
              talking_points: c.talking_points,
            });
          }
        });
      }
      
      // ========== STEP 2: GENERATE EMAILS WITH CONNECTIONS ==========
      // Process in batches of 5
      const batchSize = 5;
      for (let i = 0; i < candidatesToProcess.length; i += batchSize) {
        const batch = candidatesToProcess.slice(i, i + batchSize);
        
        // Generate for each candidate in batch
        const batchResults = await Promise.all(
          batch.map(async (candidate) => {
            try {
              // Get connection from local Map (immediate access, no state delay)
              const connectionData = connectionMap.get(candidate.id);
              const candidateConnection = connectionData?.connection || candidate.connection || null;
              const candidateHook = connectionData?.personalization_hook || candidate.personalization_hook;
              
              if (!playbookDataToSend) {
                console.warn(`No playbook data for candidate ${candidate.id}, using fallback`);
                return {
                  id: candidate.id,
                  email_subject: generateFallbackSubject(candidate),
                  email_body: generateFallbackEmail(candidate),
                  sms_message: generateFallbackSms(candidate),
                };
              }
              
              // Log what we're sending to the edge function
              console.log(`📧 Generating for Dr. ${candidate.last_name}:`);
              console.log(`   Connection:`, candidateConnection ? `P${candidateConnection.priority} - "${candidateConnection.line?.substring(0, 40)}..."` : 'null');
              console.log(`   Licenses:`, candidate.licenses?.slice(0, 5).join(', '));
              console.log(`   Job state:`, job?.state);
              
              // Get user signature data for personalized sign-offs
              const signatureData = getSignatureData();
              
              // Call edge function for email with playbook data, signature, and connection
              // CRITICAL: Use candidateConnection from connectionMap for immediate access
              const { data: emailData, error: emailError } = await supabase.functions.invoke('generate-email', {
                body: {
                  candidate_id: candidate.id,
                  job_id: jobId,
                  campaign_id: campaignId,
                  personalization_hook: candidateHook,
                  playbook_data: playbookDataToSend,
                  signature: signatureData,
                  connection: candidateConnection, // Use connection from Map
                },
              });
              
              if (emailError) {
                console.error("Email generation error:", emailError);
              }
              
              // Call edge function for SMS with playbook data, signature, and connection
              // CRITICAL: Use candidateConnection from connectionMap for immediate access
              const { data: smsData, error: smsError } = await supabase.functions.invoke('generate-sms', {
                body: {
                  candidate_id: candidate.id,
                  job_id: jobId,
                  campaign_id: campaignId,
                  personalization_hook: candidateHook,
                  playbook_data: playbookDataToSend,
                  signature: signatureData,
                  connection: candidateConnection, // Use connection from Map
                },
              });
              
              if (smsError) {
                console.error("SMS generation error:", smsError);
              }
              
              return {
                id: candidate.id,
                email_subject: emailData?.email?.subject || generateFallbackSubject(candidate),
                email_body: emailData?.email?.body || generateFallbackEmail(candidate),
                sms_message: smsData?.sms_options?.[0]?.sms || generateFallbackSms(candidate),
              };
            } catch (error) {
              console.error(`Error generating for ${candidate.id}:`, error);
              return {
                id: candidate.id,
                email_subject: generateFallbackSubject(candidate),
                email_body: generateFallbackEmail(candidate),
                sms_message: generateFallbackSms(candidate),
              };
            }
          })
        );
        
        // Update candidates with results
        setCandidates(prev => prev.map(c => {
          const result = batchResults.find(r => r.id === c.id);
          if (result) {
            return { ...c, ...result };
          }
          return c;
        }));
        
        processed += batch.length;
        setGenerationProgress(Math.round((processed / candidatesToProcess.length) * 100));
        setGeneratedCount(prev => prev + batch.length);
      }
      
      toast.success(`Generated personalized messages for ${candidatesToProcess.length} candidates!`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Some messages failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Fallback generators using Dr. LastName
  const generateFallbackSubject = (candidate: Candidate) => {
    const tier = candidate.tier || "Tier 2";
    return `${candidate.specialty || job?.specialty} - ${job?.facility_name} (~$${payRate}/hr)`;
  };
  
  const generateFallbackEmail = (candidate: Candidate) => {
    const annualPotential = Math.round(payRate * 9 * 5 * 52 / 1000);
    return `Hello Dr. ${candidate.last_name},

${candidate.personalization_hook || `Your background in ${candidate.specialty || job?.specialty} caught my attention.`}

${job?.facility_name} is seeking an experienced ${job?.specialty || 'physician'} for their ${job?.city}, ${job?.state} location.

**Key Details:**
• **Compensation**: $${payRate}/hour (~$${annualPotential}K annual potential)
• **Location**: ${job?.city}, ${job?.state}
• **Facility**: ${job?.facility_name}
• **Schedule**: Flexible with excellent work-life balance
• **Scope**: Full clinical autonomy with strong support

${candidate.talking_points?.length ? `Given your experience with ${candidate.talking_points[0]}, this role offers an excellent opportunity to continue advancing your career while significantly increasing your compensation.` : ''}

Would you have 15 minutes this week for a conversation about specifics?

Best regards,
Locums One`;
  };
  
  const generateFallbackSms = (candidate: Candidate) => {
    return `Dr. ${candidate.last_name}, $${payRate}/hr ${job?.specialty} role in ${job?.state}. Interested in details? Reply YES`;
  };
  
  // Open AI refiner for editing
  const handleOpenRefiner = (candidate: Candidate, field: 'email' | 'sms') => {
    setEditingCandidate(candidate);
    setEditingField(field);
    setShowRefiner(true);
  };
  
  // Apply refined content from AI assistant
  const handleApplyRefinement = (refinedSubject: string | undefined, refinedBody: string) => {
    if (!editingCandidate || !editingField) return;
    
    setCandidates(prev => prev.map(c => {
      if (c.id === editingCandidate.id) {
        if (editingField === 'email') {
          return { 
            ...c, 
            email_subject: refinedSubject || c.email_subject,
            email_body: refinedBody 
          };
        } else if (editingField === 'sms') {
          return { ...c, sms_message: refinedBody };
        }
      }
      return c;
    }));
    
    setShowRefiner(false);
    setEditingCandidate(null);
    setEditingField(null);
  };
  
  // Open preview modal
  const handlePreview = (candidate: Candidate) => {
    setPreviewCandidate(candidate);
    setShowPreview(true);
  };
  
  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  
  // Export all drafted messages as CSV
  const handleExportMessages = () => {
    const draftedCandidates = candidates.filter(c => c.email_body || c.sms_message);
    
    if (draftedCandidates.length === 0) {
      toast.error("No drafted messages to export. Generate messages first.");
      return;
    }
    
    // Create CSV content
    const headers = [
      "First Name",
      "Last Name", 
      "Email",
      "Phone",
      "Specialty",
      "Email Subject",
      "Email Body",
      "SMS Message"
    ];
    
    const escapeCSV = (value: string | undefined | null): string => {
      if (!value) return "";
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      const escaped = value.replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
        return `"${escaped}"`;
      }
      return escaped;
    };
    
    const rows = draftedCandidates.map(c => [
      escapeCSV(c.first_name),
      escapeCSV(c.last_name),
      escapeCSV(c.personal_email || c.email),
      escapeCSV(c.personal_mobile || c.phone),
      escapeCSV(c.specialty),
      escapeCSV(c.email_subject),
      escapeCSV(c.email_body),
      escapeCSV(c.sms_message)
    ].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personalized-messages-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${draftedCandidates.length} drafted messages`);
  };
  
  const handleNext = () => {
    sessionStorage.setItem("campaign_candidates", JSON.stringify(candidates));
    navigate("/campaigns/new/sequence");
  };
  
  const personalizedPercent = candidates.length > 0 
    ? Math.round((generatedCount / candidates.length) * 100) 
    : 0;
  
  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StepIndicator currentStep={3} steps={steps} />
          
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/20">
                  <Cat className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    Sherlock Meowmes
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Full Personalization
                    </Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generate complete personalized emails & SMS using your playbook templates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{candidates.length}</span>
                </div>
                <Badge variant="secondary" className="text-green-600">
                  ${payRate}/hr pay
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMessages}
                  disabled={generatedCount === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Playbook Selection */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Playbook Source
                  </CardTitle>
                  <CardDescription>
                    Search Notion for your team's playbook or paste content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* New Structured Cache Display */}
                  {cachedPlaybook && isStructuredCache(cachedPlaybook) && (
                    <PlaybookCacheCard 
                      cache={cachedPlaybook}
                      onSync={handleSyncPlaybook}
                      isSyncing={isSyncing}
                    />
                  )}
                  
                  {/* Legacy Cache Display */}
                  {cachedPlaybook && !isStructuredCache(cachedPlaybook) && (() => {
                    const legacy = cachedPlaybook as LegacyPlaybookCache;
                    const syncedAt = new Date(legacy.synced_at);
                    const hoursSinceSync = (Date.now() - syncedAt.getTime()) / (1000 * 60 * 60);
                    const isStale = hoursSinceSync > 24;
                    const hasValidRate = !!legacy.extracted_rates?.hourly;
                    
                    return (
                      <div className={cn(
                        "p-3 rounded-lg border",
                        isStale || !hasValidRate 
                          ? "bg-amber-500/10 border-amber-500/20" 
                          : "bg-green-500/10 border-green-500/20"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isStale || !hasValidRate ? (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                            <span className={cn(
                              "text-sm font-medium",
                              isStale || !hasValidRate ? "text-amber-700" : "text-green-700"
                            )}>
                              {isStale ? "Stale Cache" : !hasValidRate ? "Missing Rate" : "Legacy Cache"}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={handleSyncPlaybook}
                            disabled={isSyncing}
                          >
                            <RefreshCw className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
                            Upgrade Cache
                          </Button>
                        </div>
                        <p className="text-xs mt-1 text-muted-foreground">{legacy.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {legacy.extracted_rates?.hourly && (
                            <Badge className="bg-green-600 text-white text-xs">
                              ${legacy.extracted_rates.hourly}/hr
                            </Badge>
                          )}
                          {legacy.extracted_rates?.call_status && (
                            <Badge variant="outline" className="text-blue-600 border-blue-500/30 text-xs">
                              {legacy.extracted_rates.call_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Notion Search */}
                  <div className="space-y-2">
                    <Label className="text-xs">Search Notion Playbooks</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., Gastroenterologist playbook"
                        value={playbookSearch}
                        onChange={(e) => setPlaybookSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchNotionPlaybooks()}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleSearchNotionPlaybooks}
                        disabled={isSearchingPlaybooks}
                      >
                        {isSearchingPlaybooks ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Notion Results */}
                  {notionPlaybooks.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Results</Label>
                      {notionPlaybooks.map(pb => (
                        <div
                          key={pb.id}
                          onClick={() => handleSelectPlaybook(pb)}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all",
                            selectedPlaybook?.id === pb.id 
                              ? "ring-2 ring-primary bg-primary/5" 
                              : "hover:bg-secondary/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{pb.title}</p>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                          {pb.summary && (
                            <p className="text-xs text-muted-foreground mt-1">{pb.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or paste content</span>
                    </div>
                  </div>
                  
                  {/* Manual Playbook Content */}
                  <div className="space-y-2">
                    <Label className="text-xs">Playbook Content</Label>
                    <Textarea
                      placeholder="Paste your playbook templates, value props, and messaging guidelines..."
                      value={playbookContent}
                      onChange={(e) => setPlaybookContent(e.target.value)}
                      className="min-h-[200px] text-xs"
                    />
                  </div>
                  
                  {selectedPlaybook && (
                    <Badge variant="outline" className="w-full justify-center py-1.5">
                      ✓ Using: {selectedPlaybook.title}
                    </Badge>
                  )}
                </CardContent>
              </Card>
              
              {/* Progress & Actions */}
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Personalization Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {generatedCount} / {candidates.length}
                    </span>
                  </div>
                  <Progress value={personalizedPercent} className="h-2" />
                  
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    onClick={handleGenerateAll}
                    disabled={isGenerating || (!playbookContent && !selectedPlaybook)}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating... {generationProgress}%
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate All Messages
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    {!playbookContent && !selectedPlaybook 
                      ? "Select or paste a playbook first"
                      : `Will generate ${candidates.length - generatedCount} remaining`}
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Panel - Candidate Messages */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Personalized Messages</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                      <span className="mx-2">+</span>
                      <MessageSquare className="h-4 w-4" />
                      <span>SMS</span>
                    </div>
                  </div>
                  <CardDescription>
                    Review and edit personalized outreach for each candidate
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr>
                          <th className="text-left p-3 font-medium w-48">Candidate</th>
                          <th className="text-left p-3 font-medium">Email Preview</th>
                          <th className="text-left p-3 font-medium w-48">SMS Preview</th>
                          <th className="text-center p-3 font-medium w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate) => (
                          <tr key={candidate.id} className="border-b hover:bg-secondary/30">
                            <td className="p-3">
                              <div>
                                <p className="font-medium">Dr. {candidate.last_name}</p>
                                <p className="text-xs text-muted-foreground">{candidate.specialty}</p>
                                {candidate.tier && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {candidate.tier}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {candidate.email_body ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-blue-600">{candidate.email_subject}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {candidate.email_body.substring(0, 100)}...
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs italic text-amber-500">Not generated</span>
                              )}
                            </td>
                            <td className="p-3">
                              {candidate.sms_message ? (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {candidate.sms_message}
                                </p>
                              ) : (
                                <span className="text-xs italic text-amber-500">Not generated</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {candidate.email_body ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handlePreview(candidate)}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleOpenRefiner(candidate, 'email')}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/30" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => navigate("/candidates/matching")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Candidates
            </Button>
            
            <Button onClick={handleNext} disabled={generatedCount === 0}>
              Continue to Sequence Builder
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Message Preview - Dr. {previewCandidate?.last_name}
            </DialogTitle>
            <DialogDescription>
              {previewCandidate?.specialty} • {previewCandidate?.tier || "Candidate"}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activePreviewTab} onValueChange={setActivePreviewTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="email" className="mt-4">
              <div className="space-y-3">
                <div className="p-3 rounded bg-secondary/50">
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="font-medium">{previewCandidate?.email_subject}</p>
                </div>
                <ScrollArea className="h-[400px] p-4 rounded border">
                  <div className="whitespace-pre-wrap text-sm">
                    {previewCandidate?.email_body}
                  </div>
                </ScrollArea>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCopy(previewCandidate?.email_body || "")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Email
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="sms" className="mt-4">
              <div className="space-y-3">
                <div className="p-4 rounded border bg-green-500/5">
                  <p className="text-sm">{previewCandidate?.sms_message}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Character count: {previewCandidate?.sms_message?.length || 0}</span>
                  <span className={cn(
                    (previewCandidate?.sms_message?.length || 0) > 160 ? "text-destructive" : ""
                  )}>
                    {(previewCandidate?.sms_message?.length || 0) > 160 ? "⚠️ Over 160 chars" : "✓ Within limit"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCopy(previewCandidate?.sms_message || "")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy SMS
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* AI Message Refiner Sheet */}
      <Sheet open={showRefiner} onOpenChange={(open) => {
        if (!open) {
          setShowRefiner(false);
          setEditingCandidate(null);
          setEditingField(null);
        }
      }}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0">
          {editingCandidate && editingField && (
            <MessageRefiner
              messageType={editingField}
              currentSubject={editingField === 'email' ? editingCandidate.email_subject : undefined}
              currentBody={editingField === 'email' ? (editingCandidate.email_body || "") : (editingCandidate.sms_message || "")}
              candidateContext={{
                name: `Dr. ${editingCandidate.last_name}`,
                specialty: editingCandidate.specialty,
                licenses: editingCandidate.licenses,
              }}
              jobContext={{
                rate: `$${payRate}`,
                location: `${job?.city || ''}, ${job?.state || ''}`,
                call_status: isStructuredCache(cachedPlaybook) ? cachedPlaybook.clinical?.call_status || '' : '',
                facility_name: job?.facility_name || '',
              }}
              playbookData={isStructuredCache(cachedPlaybook) ? cachedPlaybook : undefined}
              onApply={handleApplyRefinement}
              onClose={() => {
                setShowRefiner(false);
                setEditingCandidate(null);
                setEditingField(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
