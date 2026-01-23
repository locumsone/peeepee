import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  state?: string;
  city?: string;
  company_name?: string;
  licenses?: string[];
  npi?: string;
  graduation_year?: number;
  board_certifications?: string[];
  enrichment_tier?: string;
}

interface JobContext {
  id: string;
  specialty?: string;
  state?: string;
  city?: string;
  facility_name?: string;
  bill_rate?: number;
  pay_rate?: number;
  raw_job_text?: string;
  personalization_playbook?: string;
}

interface PersonalizationResult {
  candidate_id: string;
  candidate_name: string;
  personalization_hook: string;
  hook_type: string;
  confidence: 'high' | 'medium' | 'low';
  research_sources: string[];
  talking_points: string[];
  icebreaker: string;
  research_summary?: string;
}

// Default playbook patterns - used when job doesn't have custom playbook
const DEFAULT_HOOK_PATTERNS = [
  {
    type: "fellowship_training",
    priority: 1,
    use_when: "Candidate has fellowship training in relevant specialty",
    pattern: "Your {specialty} fellowship at {institution} prepared you for exactly this scope: {job_procedures}. This is true {specialty} work, not watered-down diagnostic. {compensation} for work you're already trained to do."
  },
  {
    type: "elite_compensation",
    priority: 2,
    use_when: "Candidate mentions compensation or is in lower-paying position",
    pattern: "{rate}/hour for {specialty} work is elite locums compensation - that's {weekly} per week or {annual} annually. Compare to typical employed salary {employed_salary}. Even working 6-9 months/year at this rate exceeds full-year employment income."
  },
  {
    type: "license_priority",
    priority: 3,
    use_when: "Candidate has required state license or IMLC",
    pattern: "You have {license_type} = priority credentialing. Credentialing timeline: 90 days for you vs 6-9 months for out-of-state physicians needing new license. {facility} will prioritize candidates with existing {state} license because you can start quickly."
  },
  {
    type: "location_advantage",
    priority: 4,
    use_when: "Candidate in expensive market or mentions location flexibility",
    pattern: "{city} offers elite compensation ({rate}/hour) with excellent cost of living. {state} has no state income tax - keep more of every dollar. Even working 6 months/year ({half_annual}), you'd exceed current income while having 6 months off."
  },
  {
    type: "work_life_balance",
    priority: 5,
    use_when: "Candidate mentions work-life balance or schedule preferences",
    pattern: "{schedule} with manageable call = predictable lifestyle. Day shift only, no overnight shifts, weekends free most weeks. {compensation} while maintaining work-life balance - best of both worlds."
  },
  {
    type: "system_prestige",
    priority: 6,
    use_when: "Candidate values system quality or academic connections",
    pattern: "{facility} is a premier health system - excellent resources, top-tier reputation. Working here = excellent CV addition, strong references, networking opportunities. Not small community hospital - major academic-affiliated system."
  },
  {
    type: "career_transition",
    priority: 7,
    use_when: "Candidate between positions or seeking change",
    pattern: "If you're between positions, this bridges gap with elite income. If you're academic {specialty}, this provides private practice experience + significant supplemental income at {rate}/hour."
  },
  {
    type: "generic_specialty_match",
    priority: 10,
    use_when: "Basic specialty match without specific details",
    pattern: "Your background in {specialty} caught our attention. {facility} in {city}, {state} needs {specialty} coverage - {rate}/hour, {schedule}. Long-term assignment with locums flexibility."
  }
];

// Research a candidate using Perplexity web search - OPTIMIZED for speed
async function deepResearchCandidate(
  perplexityKey: string,
  candidate: Candidate,
  job: JobContext
): Promise<{ summary: string; sources: string[]; details: any }> {
  
  try {
    // Use a more targeted, faster query
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar', // Fast model
        messages: [
          {
            role: 'system',
            content: `You are a healthcare recruiter assistant. Find 1-2 specific, verifiable facts about this physician for personalized outreach. Be VERY BRIEF - max 3 sentences. Focus on: fellowship/training, current hospital, or notable achievements. If nothing found, say "No specific info found."`
          },
          {
            role: 'user',
            content: `Dr. ${candidate.first_name} ${candidate.last_name}, ${candidate.specialty || 'physician'}${candidate.state ? `, ${candidate.state}` : ''}${candidate.npi ? ` (NPI: ${candidate.npi})` : ''}`
          }
        ],
        temperature: 0.1,
        max_tokens: 300, // Reduced from 800 for faster response
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return { summary: '', sources: [], details: {} };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Quick parse - just look for key info
    const details = {
      fellowship: extractSection(content, ['fellowship', 'training', 'residency']),
      employer: extractSection(content, ['hospital', 'employer', 'works at', 'affiliated']),
      certifications: extractSection(content, ['board certified', 'certification']),
    };

    return {
      summary: content,
      sources: citations,
      details
    };
  } catch (error) {
    console.error('Deep research error:', error);
    return { summary: '', sources: [], details: {} };
  }
}

function extractSection(text: string, keywords: string[]): string | null {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const idx = lowerText.indexOf(keyword);
    if (idx !== -1) {
      // Extract the sentence containing this keyword
      const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
      const end = text.indexOf('.', idx + keyword.length);
      if (end > start) {
        return text.substring(start, end + 1).trim();
      }
    }
  }
  return null;
}

// Select best hook pattern based on candidate and research
function selectHookPattern(
  candidate: Candidate,
  job: JobContext,
  researchDetails: any,
  customPlaybook?: string
): { type: string; pattern: string } {
  // If job has custom playbook text, parse it for patterns
  if (customPlaybook) {
    // Look for fellowship-specific hooks
    if (researchDetails?.fellowship && customPlaybook.toLowerCase().includes('fellowship')) {
      return {
        type: 'fellowship_training',
        pattern: DEFAULT_HOOK_PATTERNS[0].pattern
      };
    }
  }

  // Priority selection based on available data
  if (researchDetails?.fellowship) {
    return { type: 'fellowship_training', pattern: DEFAULT_HOOK_PATTERNS[0].pattern };
  }

  // Check if candidate has required license
  const hasStateLicense = candidate.licenses?.some(
    l => l.toUpperCase() === job.state?.toUpperCase()
  );
  const hasImlc = (candidate.licenses?.length || 0) >= 10;
  
  if (hasStateLicense || hasImlc) {
    return { type: 'license_priority', pattern: DEFAULT_HOOK_PATTERNS[2].pattern };
  }

  // Check for board certifications match
  if (candidate.board_certifications?.length && researchDetails?.certifications) {
    return { type: 'fellowship_training', pattern: DEFAULT_HOOK_PATTERNS[0].pattern };
  }

  // Fallback to compensation hook
  if (job.bill_rate && job.bill_rate >= 400) {
    return { type: 'elite_compensation', pattern: DEFAULT_HOOK_PATTERNS[1].pattern };
  }

  // Default generic match
  return { type: 'generic_specialty_match', pattern: DEFAULT_HOOK_PATTERNS[7].pattern };
}

// Generate personalized hook using AI - OPTIMIZED for speed
async function generatePersonalizedHook(
  lovableKey: string,
  candidate: Candidate,
  job: JobContext,
  hookPattern: { type: string; pattern: string },
  researchSummary: string
): Promise<{ hook: string; icebreaker: string; talking_points: string[] }> {
  
  // If we have good research, generate a quick hook without full AI call
  if (researchSummary && researchSummary.length > 50 && !researchSummary.includes("No specific info")) {
    // Fast path: Use research findings directly to build hook
    const hook = buildQuickHook(candidate, job, researchSummary, hookPattern.type);
    // Generate a proper icebreaker from research, not just a greeting
    const icebreaker = buildQuickIcebreaker(candidate, job, researchSummary);
    return {
      hook,
      icebreaker,
      talking_points: buildQuickTalkingPoints(candidate, job, researchSummary)
    };
  }

  // Fallback to AI only if research is empty/generic
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `Create a 2-sentence personalized recruiter hook for a physician. Be specific. Return JSON only: {"hook":"...","icebreaker":"...","talking_points":["...",".."]}` 
          },
          { 
            role: "user", 
            content: `Dr. ${candidate.first_name} ${candidate.last_name}, ${candidate.specialty}. Job: ${job.specialty} at ${job.facility_name}, ${job.city}, ${job.state}. $${job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : 'competitive')}/hr. Research: ${researchSummary || 'None'}` 
          }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          hook: parsed.hook || buildQuickHook(candidate, job, researchSummary, hookPattern.type),
          icebreaker: parsed.icebreaker || `Hi Dr. ${candidate.last_name},`,
          talking_points: parsed.talking_points || buildQuickTalkingPoints(candidate, job, researchSummary)
        };
      }
    } catch {
      // JSON parse failed, use content directly
    }
  } catch (error) {
    console.error('AI generation error:', error);
  }

  // Fallback
  return {
    hook: buildQuickHook(candidate, job, researchSummary, hookPattern.type),
    icebreaker: buildQuickIcebreaker(candidate, job, researchSummary),
    talking_points: buildQuickTalkingPoints(candidate, job, researchSummary)
  };
}

// Fast hook builder without AI - uses PAY RATE (what candidate receives), not bill rate
function buildQuickHook(candidate: Candidate, job: JobContext, research: string, hookType: string): string {
  const hasStateLicense = candidate.licenses?.some(l => l.toUpperCase() === job.state?.toUpperCase());
  // Use pay_rate (what candidate gets), fallback to bill_rate * 0.73 if not set
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  const rate = candidateRate ? `$${candidateRate}/hour` : 'competitive rate';
  
  if (research && research.length > 30 && !research.includes("No specific")) {
    // Extract first meaningful sentence from research
    const firstSentence = research.split('.')[0].trim();
    if (firstSentence.length > 20) {
      return `${firstSentence}. This makes you ideal for our ${job.specialty} opportunity at ${job.facility_name} - ${rate}.`;
    }
  }
  
  if (hasStateLicense) {
    return `Your ${job.state} license + ${candidate.specialty} experience = priority credentialing for ${job.facility_name}. ${rate}, start quickly.`;
  }
  
  return `Your ${candidate.specialty || 'medical'} background aligns with our ${job.specialty} opportunity at ${job.facility_name}. ${rate}, ${job.city}, ${job.state}.`;
}

// Build a proper icebreaker sentence (not just a greeting) - uses research insights
function buildQuickIcebreaker(candidate: Candidate, job: JobContext, research: string): string {
  const hasStateLicense = candidate.licenses?.some(l => l.toUpperCase() === job.state?.toUpperCase());
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  
  // Extract key details from research to personalize
  if (research && research.length > 30 && !research.includes("No specific")) {
    // Look for hospital/institution mentions
    const hospitalMatch = research.match(/(at|from|with)\s+([A-Z][A-Za-z\s]+(?:Hospital|Medical Center|Health|Clinic))/i);
    if (hospitalMatch) {
      return `Dr. ${candidate.last_name}, I noticed your work at ${hospitalMatch[2].trim()} and wanted to reach out about a ${job.specialty} opportunity in ${job.state} that could be a great fit.`;
    }
    
    // Look for specialty/subspecialty mentions
    const specialtyMatch = research.match(/(expertise|experience|specializ\w+|focus\w*)\s+(in|on)\s+([A-Za-z\s,&]+)/i);
    if (specialtyMatch) {
      return `Dr. ${candidate.last_name}, your ${specialtyMatch[3].trim().substring(0, 50)} caught my attention - I have a ${job.specialty} role at ${job.facility_name} that matches your background.`;
    }
  }
  
  // License-based icebreaker
  if (hasStateLicense) {
    return `Dr. ${candidate.last_name}, I noticed you're already licensed in ${job.state} and wanted to share a ${job.specialty} opportunity at ${job.facility_name}${candidateRate ? ` paying $${candidateRate}/hr` : ''}.`;
  }
  
  // Multi-state license holder
  if ((candidate.licenses?.length || 0) >= 5) {
    return `Dr. ${candidate.last_name}, with your multi-state licensure, I thought you'd be interested in a ${job.specialty} opportunity in ${job.city}, ${job.state}${candidateRate ? ` at $${candidateRate}/hr` : ''}.`;
  }
  
  // Default fallback - still a full sentence, not just "Hi Dr. X"
  return `Dr. ${candidate.last_name}, I'm reaching out about a ${job.specialty} opportunity at ${job.facility_name} in ${job.city}, ${job.state}${candidateRate ? ` - $${candidateRate}/hr` : ''} that aligns with your background.`;
}

// Fast talking points without AI - uses PAY RATE (what candidate receives)
function buildQuickTalkingPoints(candidate: Candidate, job: JobContext, research: string): string[] {
  const points: string[] = [];
  
  // Use pay_rate (what candidate gets), fallback to bill_rate * 0.73 if not set
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  if (candidateRate) points.push(`$${candidateRate}/hour - elite locums compensation`);
  if (job.facility_name) points.push(`${job.facility_name} - established health system`);
  
  const hasStateLicense = candidate.licenses?.some(l => l.toUpperCase() === job.state?.toUpperCase());
  if (hasStateLicense) {
    points.push(`Already licensed in ${job.state} - expedited credentialing`);
  } else if ((candidate.licenses?.length || 0) >= 10) {
    points.push(`Multi-state licensure - IMLC eligible for faster start`);
  }
  
  points.push('Long-term assignment with locums flexibility');
  
  return points.slice(0, 4);
}

// Process a single candidate - used for parallel processing
async function processCandidate(
  candidate: Candidate,
  job: JobContext,
  perplexityKey: string | undefined,
  lovableKey: string | undefined,
  useDeepResearch: boolean
): Promise<PersonalizationResult> {
  let researchSummary = '';
  let researchSources: string[] = [];
  let researchDetails: any = {};

  // Deep research with Perplexity if enabled
  if (useDeepResearch && perplexityKey) {
    console.log(`Deep researching: ${candidate.first_name} ${candidate.last_name}`);
    const research = await deepResearchCandidate(perplexityKey, candidate, job);
    researchSummary = research.summary;
    researchSources = research.sources;
    researchDetails = research.details;
  }

  // Select hook pattern
  const hookPattern = selectHookPattern(
    candidate, 
    job, 
    researchDetails,
    job.personalization_playbook
  );

  // Generate personalized content
  let hook = '';
  let icebreaker = '';
  let talking_points: string[] = [];

  if (lovableKey) {
    const generated = await generatePersonalizedHook(
      lovableKey,
      candidate,
      job,
      hookPattern,
      researchSummary
    );
    hook = generated.hook;
    icebreaker = generated.icebreaker;
    talking_points = generated.talking_points;
  } else {
    // Basic fallback without AI - use pay_rate
    const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
    const rateText = candidateRate ? `$${candidateRate}/hour` : 'competitive rate';
    hook = `Your ${candidate.specialty || 'medical'} background makes you a strong fit for our ${job.specialty} opportunity at ${job.facility_name}. ${rateText}, ${job.city}, ${job.state}.`;
    icebreaker = `Hi Dr. ${candidate.last_name},`;
    talking_points = ['Competitive compensation', 'Excellent facility', 'Flexible scheduling'];
  }

  // Determine confidence based on research quality
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (researchDetails?.fellowship || researchDetails?.employer) {
    confidence = 'high';
  } else if (researchSummary && researchSummary.length > 200) {
    confidence = 'medium';
  } else if (candidate.board_certifications?.length || candidate.licenses?.length) {
    confidence = 'medium';
  }

  return {
    candidate_id: candidate.id,
    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
    personalization_hook: hook,
    hook_type: hookPattern.type,
    confidence,
    research_sources: researchSources,
    talking_points,
    icebreaker,
    research_summary: researchSummary || undefined
  };
}

// Process candidates in batches with parallelization
async function processCandidatesInBatches(
  candidates: Candidate[],
  job: JobContext,
  perplexityKey: string | undefined,
  lovableKey: string | undefined,
  useDeepResearch: boolean,
  batchSize: number = 5
): Promise<PersonalizationResult[]> {
  const results: PersonalizationResult[] = [];
  
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidates.length / batchSize)} (${batch.length} candidates)`);
    
    // Process batch in parallel
    const batchPromises = batch.map(candidate => 
      processCandidate(candidate, job, perplexityKey, lovableKey, useDeepResearch)
        .catch(error => {
          console.error(`Error processing ${candidate.first_name} ${candidate.last_name}:`, error);
          // Return fallback result on error
          return {
            candidate_id: candidate.id,
            candidate_name: `${candidate.first_name} ${candidate.last_name}`,
            personalization_hook: `Your ${candidate.specialty || 'medical'} background aligns with our ${job.specialty} opportunity.`,
            hook_type: 'generic_specialty_match',
            confidence: 'low' as const,
            research_sources: [],
            talking_points: ['Competitive compensation', 'Excellent facility'],
            icebreaker: `Hi Dr. ${candidate.last_name},`
          };
        })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { 
      candidate_ids, 
      job_id, 
      deep_research = false,
      custom_playbook,
      batch_size = 5  // Allow caller to configure batch size
    } = await req.json();

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      throw new Error('candidate_ids array is required');
    }
    if (!job_id) {
      throw new Error('job_id is required');
    }

    // Limit candidates per request to prevent timeouts
    const MAX_CANDIDATES = 20;
    const limitedCandidateIds = candidate_ids.slice(0, MAX_CANDIDATES);
    const wasLimited = candidate_ids.length > MAX_CANDIDATES;
    
    if (wasLimited) {
      console.log(`Limited from ${candidate_ids.length} to ${MAX_CANDIDATES} candidates to prevent timeout`);
    }

    console.log(`Personalization research for ${limitedCandidateIds.length} candidates, deep_research=${deep_research}`);

    // Fetch job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !jobData) {
      throw new Error('Job not found');
    }

    const job: JobContext = {
      id: jobData.id,
      specialty: jobData.specialty,
      state: jobData.state,
      city: jobData.city,
      facility_name: jobData.facility_name,
      bill_rate: jobData.bill_rate,
      pay_rate: jobData.pay_rate,
      raw_job_text: jobData.raw_job_text,
      personalization_playbook: custom_playbook || jobData.personalization_playbook
    };

    // Fetch candidates
    const { data: candidatesData, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, specialty, state, city, company_name, licenses, npi, graduation_year, board_certifications, enrichment_tier')
      .in('id', limitedCandidateIds);

    if (candidatesError || !candidatesData) {
      throw new Error('Failed to fetch candidates');
    }

    // Check for existing deep research to avoid duplicate API calls
    const { data: existingMatches } = await supabase
      .from('candidate_job_matches')
      .select('candidate_id, icebreaker, talking_points')
      .eq('job_id', job_id)
      .in('candidate_id', limitedCandidateIds);

    const alreadyResearchedMap = new Map<string, { icebreaker: string; talking_points: string[] }>();
    if (existingMatches) {
      for (const match of existingMatches) {
        // Consider it "already researched" if it has both icebreaker AND talking points
        if (match.icebreaker && match.talking_points && match.talking_points.length > 0) {
          alreadyResearchedMap.set(match.candidate_id, {
            icebreaker: match.icebreaker,
            talking_points: match.talking_points
          });
        }
      }
    }

    // Split candidates into those needing research and those with cached results
    const candidatesNeedingResearch = candidatesData.filter(c => !alreadyResearchedMap.has(c.id));
    const cachedResults: PersonalizationResult[] = candidatesData
      .filter(c => alreadyResearchedMap.has(c.id))
      .map(c => {
        const cached = alreadyResearchedMap.get(c.id)!;
        return {
          candidate_id: c.id,
          candidate_name: `${c.first_name} ${c.last_name}`,
          personalization_hook: cached.icebreaker,
          hook_type: 'cached',
          confidence: 'high' as const,
          research_sources: [],
          talking_points: cached.talking_points,
          icebreaker: cached.icebreaker,
          research_summary: 'Previously researched',
          from_cache: true
        };
      });

    if (candidatesNeedingResearch.length === 0) {
      console.log(`All ${limitedCandidateIds.length} candidates already have deep research cached`);
      return new Response(
        JSON.stringify({
          success: true,
          results: cachedResults,
          deep_research_used: false,
          total_candidates: cachedResults.length,
          from_cache: cachedResults.length,
          was_limited: wasLimited,
          original_count: candidate_ids.length,
          high_confidence: cachedResults.length,
          medium_confidence: 0,
          low_confidence: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${candidatesNeedingResearch.length} candidates (${cachedResults.length} from cache)`);

    const useDeepResearch = deep_research && !!PERPLEXITY_API_KEY;
    
    // Use smaller batch size for deep research (more API calls per candidate)
    const effectiveBatchSize = useDeepResearch ? Math.min(batch_size, 3) : batch_size;
    
    // Process only candidates that need research
    const newResults = await processCandidatesInBatches(
      candidatesNeedingResearch,
      job,
      PERPLEXITY_API_KEY,
      LOVABLE_API_KEY,
      useDeepResearch,
      effectiveBatchSize
    );

    // Combine new results with cached results
    const allResults = [...newResults, ...cachedResults];

    // Store only NEW results in candidate_job_matches (in parallel)
    const upsertPromises = newResults.map(async (result: PersonalizationResult) => {
      try {
        console.log(`Saving deep research for candidate ${result.candidate_id}: icebreaker="${result.icebreaker?.substring(0, 30)}...", talking_points=${result.talking_points?.length || 0}`);
        const { data, error } = await supabase.rpc('upsert_candidate_job_match', {
          p_candidate_id: result.candidate_id,
          p_job_id: job_id,
          p_research_id: null,
          p_match_score: null,
          p_match_grade: null,
          p_match_reasons: null,
          p_match_concerns: null,
          p_talking_points: result.talking_points || [],
          p_icebreaker: result.icebreaker || null,
          p_has_required_license: null,
          p_license_path: null
        });
        if (error) {
          console.error(`RPC error for ${result.candidate_id}:`, error);
        } else {
          console.log(`Successfully saved research for ${result.candidate_id}, match_id: ${data}`);
        }
      } catch (e) {
        console.error('Failed to upsert match:', e);
      }
    });
    
    await Promise.all(upsertPromises);

    console.log(`Generated ${newResults.length} new hooks, ${cachedResults.length} from cache`);

    return new Response(
      JSON.stringify({
        success: true,
        results: allResults,
        deep_research_used: useDeepResearch,
        total_candidates: allResults.length,
        from_cache: cachedResults.length,
        newly_researched: newResults.length,
        was_limited: wasLimited,
        original_count: candidate_ids.length,
        high_confidence: allResults.filter((r: PersonalizationResult) => r.confidence === 'high').length,
        medium_confidence: allResults.filter((r: PersonalizationResult) => r.confidence === 'medium').length,
        low_confidence: allResults.filter((r: PersonalizationResult) => r.confidence === 'low').length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Personalization research error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
