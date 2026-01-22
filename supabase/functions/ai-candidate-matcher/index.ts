import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobData {
  id: string;
  job_name: string;
  facility_name: string;
  specialty: string;
  city: string;
  state: string;
  pay_rate: number;
  bill_rate: number;
  requirements?: string[];
  start_date?: string;
  schedule?: string;
  raw_job_text?: string;
}

interface DbCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  personal_email: string | null;
  personal_mobile: string | null;
  specialty: string;
  city: string | null;
  state: string | null;
  licenses: string[];
  license_count: number;
  enrichment_tier: string;
  enrichment_source: string | null;
  unified_score: string;
  score_sort: number;
  has_work_contact: boolean;
  has_personal_contact: boolean;
  needs_enrichment: boolean;
  already_enriched: boolean;
  years_of_experience?: number;
  board_certified?: boolean;
  compact_license?: boolean;
  availability_months?: string[];
}

interface AlphaSophiaHCP {
  id: string;
  npi: string;
  name: string;
  taxonomy?: { code: string; description: string };
  licensure?: string[];
  contact?: { email?: string[]; phone?: string[] };
  location?: { city: string; state: string };
}

interface AIMatchResult {
  id: string;
  match_score: number;
  grade: string;
  match_reasons: string[];
  concerns: string[];
  icebreaker: string;
  talking_points: string[];
}

interface OutputCandidate {
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
  is_enriched: boolean;
  work_email?: string;
  work_phone?: string;
  personal_mobile?: string;
  personal_email?: string;
  source?: string;
  alpha_sophia_id?: string;
  npi?: string;
  match_concerns?: string[];
}

interface AlphaSophiaConfig {
  min_local_threshold: number;
  max_results_per_search: number;
  daily_limit: number;
  admin_daily_limit: number;
  cost_per_lookup: number;
  enabled: boolean;
}

interface LimitCheck {
  allowed: boolean;
  remaining: number;
  daily_limit: number;
  used_today: number;
  is_admin: boolean;
}

// Use AI to calculate accurate match scores
async function getAIMatchScores(
  apiKey: string,
  job: JobData,
  candidates: DbCandidate[]
): Promise<Map<string, AIMatchResult>> {
  const results = new Map<string, AIMatchResult>();
  
  const candidateSummaries = candidates.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    specialty: c.specialty,
    location: c.city && c.state ? `${c.city}, ${c.state}` : c.state || 'Unknown',
    licenses: c.licenses || [],
    license_count: c.license_count || 0,
    years_experience: c.years_of_experience || null,
    board_certified: c.board_certified || false,
    compact_license: c.compact_license || false,
    enrichment_tier: c.enrichment_tier,
    has_contact: c.has_personal_contact,
    availability: c.availability_months || [],
  }));

  const systemPrompt = `You are an expert healthcare recruiter AI that evaluates candidate-job fit for locum tenens (temporary physician staffing) positions.

You MUST carefully analyze the full job description to understand:
- Required procedures and clinical skills
- License requirements (state license, IMLC, compact)
- Call/on-call requirements
- Schedule and availability needs
- EMR systems experience
- Specialty and subspecialty requirements

Score candidates considering:
1. Specialty match (exact match is critical, subspecialty matters)
2. License status (having the required state license is critical, IMLC/compact is valuable)
3. Clinical skills match (procedures mentioned in job vs candidate experience)
4. Location proximity (local candidates reduce travel costs)
5. Experience level and board certification
6. Contact availability (candidates with verified contact info are more actionable)
7. Multi-state licensure (10+ licenses indicates experienced locum traveler)

Grades: A+ (95-100), A (90-94), A- (85-89), B+ (80-84), B (75-79), B- (70-74), C+ (65-69), C (60-64), D (<60)`;

  // Use raw job text if available for full context
  const buildJobDetails = () => {
    if (job.raw_job_text) return job.raw_job_text;
    
    const location = job.city ? `${job.city}, ${job.state}` : job.state;
    const pay = job.pay_rate ? `$${job.pay_rate}/hr` : 'Competitive';
    const reqs = job.requirements?.length ? `Requirements: ${job.requirements.join(', ')}` : '';
    
    return `JOB: ${job.job_name || job.specialty}
Specialty: ${job.specialty}
Facility: ${job.facility_name || 'Not specified'}
Location: ${location}
Pay: ${pay}
Schedule: ${job.schedule || 'Not specified'}
Start Date: ${job.start_date || 'ASAP'}
${reqs}`.trim();
  };
  
  const jobDetails = buildJobDetails();

  const userPrompt = `Evaluate these candidates for the following locum tenens job:

=== FULL JOB DESCRIPTION ===
${jobDetails}
=== END JOB DESCRIPTION ===

CANDIDATES TO EVALUATE:
${JSON.stringify(candidateSummaries, null, 2)}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_candidates",
            description: "Score each candidate's match to the job",
            parameters: {
              type: "object",
              properties: {
                candidates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      match_score: { type: "number", description: "0-100" },
                      grade: { type: "string", enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"] },
                      match_reasons: { type: "array", items: { type: "string" } },
                      concerns: { type: "array", items: { type: "string" } },
                      icebreaker: { type: "string" },
                      talking_points: { type: "array", items: { type: "string" } }
                    },
                    required: ["id", "match_score", "grade", "match_reasons", "concerns", "icebreaker", "talking_points"]
                  }
                }
              },
              required: ["candidates"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "score_candidates" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      for (const candidate of parsed.candidates || []) {
        results.set(candidate.id, {
          id: candidate.id,
          match_score: candidate.match_score,
          grade: candidate.grade,
          match_reasons: candidate.match_reasons || [],
          concerns: candidate.concerns || [],
          icebreaker: candidate.icebreaker || '',
          talking_points: candidate.talking_points || [],
        });
      }
    }
  } catch (error) {
    console.error('AI scoring error:', error);
    throw error;
  }
  
  return results;
}

// Fallback scoring
function calculateMatchStrength(unifiedScore: string): number {
  const scoreMap: Record<string, number> = {
    'A+': 98, 'A': 95, 'A-': 90,
    'B+': 85, 'B': 80, 'B-': 75,
    'C+': 70, 'C': 65, 'C-': 60,
    'D': 50,
  };
  return scoreMap[unifiedScore] || 50;
}

function generateScoreReason(candidate: DbCandidate, job: JobData): string {
  const reasons: string[] = [];
  if (candidate.licenses?.includes(job.state)) reasons.push(`Licensed in ${job.state}`);
  if (candidate.license_count >= 10) reasons.push(`${candidate.license_count} state licenses`);
  else if (candidate.license_count >= 5) reasons.push(`Multi-state licensed (${candidate.license_count})`);
  if (candidate.enrichment_tier === 'Platinum') reasons.push('Highly engaged candidate');
  if (candidate.specialty?.toLowerCase() === job.specialty?.toLowerCase()) reasons.push(`Exact ${job.specialty} match`);
  return reasons.join(' • ') || 'Matches job requirements';
}

function generateIcebreaker(candidate: DbCandidate, job: JobData): string {
  const name = candidate.first_name || 'there';
  const location = job.city ? `${job.city}, ${job.state}` : job.state;
  return `Hi ${name}, I came across your profile and thought you'd be a great fit for a ${job.specialty || 'healthcare'} opportunity in ${location}.`;
}

function generateTalkingPoints(candidate: DbCandidate, job: JobData): string[] {
  const points: string[] = [];
  if (candidate.licenses?.includes(job.state)) points.push(`Already licensed in ${job.state} - can start quickly`);
  if (job.pay_rate) points.push(`Competitive pay rate: $${job.pay_rate}/hr`);
  if (job.facility_name) points.push(`Position at ${job.facility_name}`);
  if (candidate.license_count > 5) points.push('Flexible for multi-state assignments');
  return points.length > 0 ? points : ['Great opportunity matching your specialty'];
}

async function searchAlphaSophia(
  apiKey: string,
  specialty: string,
  state: string,
  pageSize: number
): Promise<OutputCandidate[]> {
  const queryParams = new URLSearchParams();
  queryParams.set('pageSize', String(Math.min(pageSize, 100)));
  queryParams.set('page', '1');
  if (state) queryParams.set('state', `+${state}`);
  if (specialty) queryParams.set('taxonomy', `+"${specialty}"`);
  queryParams.set('contact', 'email');
  
  const response = await fetch(
    `https://api.alphasophia.com/v1/search/hcp?${queryParams.toString()}`,
    { method: 'GET', headers: { 'Accept': 'application/json', 'x-api-key': apiKey } }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Alpha Sophia error:', response.status, errorText);
    throw new Error(`Alpha Sophia API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return (data.data || []).map((hcp: AlphaSophiaHCP) => {
    const nameParts = (hcp.name || '').split(',').map((s: string) => s.trim());
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    
    return {
      id: `as_${hcp.id}`,
      alpha_sophia_id: hcp.id,
      npi: hcp.npi,
      first_name: firstName,
      last_name: lastName,
      specialty: hcp.taxonomy?.description || specialty,
      state: hcp.location?.state || state,
      city: hcp.location?.city || undefined,
      unified_score: 'B',
      match_strength: 75,
      licenses: hcp.licensure || [],
      licenses_count: hcp.licensure?.length || 0,
      enrichment_tier: 'Alpha Sophia',
      score_reason: 'External healthcare provider database match',
      icebreaker: `Hi ${firstName}, I found your profile and thought you'd be a great fit.`,
      talking_points: [`Licensed in ${hcp.licensure?.length || 0} states`, 'Contact information verified'],
      has_personal_contact: !!(hcp.contact?.email?.length || hcp.contact?.phone?.length),
      needs_enrichment: false,
      is_enriched: false,
      work_email: hcp.contact?.email?.[0] || undefined,
      work_phone: hcp.contact?.phone?.[0] || undefined,
      source: 'alpha_sophia',
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ALPHA_SOPHIA_API_KEY = Deno.env.get('ALPHA_SOPHIA_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { job_id, limit = 25, offset = 0, force_alpha_sophia = false, user_id = null } = await req.json();
    
    if (!job_id) throw new Error('job_id is required');

    console.log(`Matching candidates for job: ${job_id}, limit: ${limit}, offset: ${offset}`);

    const { data: configData } = await supabase.from('alpha_sophia_config').select('*').limit(1).single();
    const config: AlphaSophiaConfig = configData || {
      min_local_threshold: 15, max_results_per_search: 50, daily_limit: 500,
      admin_daily_limit: 2000, cost_per_lookup: 0.05, enabled: true,
    };

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_name, facility_name, specialty, city, state, pay_rate, bill_rate, requirements, start_date, schedule, raw_job_text')
      .eq('id', job_id)
      .single();

    if (jobError) {
      console.error('Job query error:', jobError);
      throw new Error(`Job not found: ${job_id}`);
    }
    if (!jobData) throw new Error(`Job not found: ${job_id}`);
    const job = jobData as JobData;
    console.log(`Job: ${job.job_name} - ${job.specialty} in ${job.state}`);

    const { data: localCandidates, error: matchError } = await supabase
      .rpc('campaign_candidate_search', { p_job_id: job_id });

    if (matchError) {
      console.error('Database match error:', matchError);
      throw new Error('Failed to search candidates');
    }

    const dbCandidates = (localCandidates || []) as DbCandidate[];
    console.log(`Found ${dbCandidates.length} local candidates`);

    const ENRICHED_SOURCES = ['Whitepages', 'PDL', 'Apollo', 'Hunter', 'Clearbit', 'ZoomInfo'];
    
    // Use AI to score candidates
    let aiScores: Map<string, AIMatchResult> = new Map();
    
    if (LOVABLE_API_KEY && dbCandidates.length > 0) {
      console.log('Using AI for candidate scoring...');
      try {
        aiScores = await getAIMatchScores(LOVABLE_API_KEY, job, dbCandidates.slice(0, 50));
        console.log(`AI scored ${aiScores.size} candidates`);
      } catch (aiError) {
        console.error('AI scoring failed, falling back to rule-based:', aiError);
      }
    }
    
    let candidates: OutputCandidate[] = dbCandidates.map((c) => {
      const isEnriched = !!c.enrichment_source && ENRICHED_SOURCES.includes(c.enrichment_source);
      const aiResult = aiScores.get(c.id);
      
      return {
        id: c.id,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        specialty: c.specialty || '',
        state: c.state || '',
        city: c.city || undefined,
        unified_score: aiResult?.grade || c.unified_score,
        match_strength: aiResult?.match_score || calculateMatchStrength(c.unified_score),
        licenses: c.licenses || [],
        licenses_count: c.license_count || 0,
        enrichment_tier: c.enrichment_tier || 'Basic',
        enrichment_source: c.enrichment_source || undefined,
        score_reason: aiResult?.match_reasons?.join(' • ') || generateScoreReason(c, job),
        icebreaker: aiResult?.icebreaker || generateIcebreaker(c, job),
        talking_points: aiResult?.talking_points || generateTalkingPoints(c, job),
        has_personal_contact: c.has_personal_contact,
        needs_enrichment: c.needs_enrichment,
        is_enriched: isEnriched,
        work_email: c.email || undefined,
        work_phone: c.phone || undefined,
        personal_mobile: c.personal_mobile || undefined,
        personal_email: c.personal_email || undefined,
        source: 'database',
        match_concerns: aiResult?.concerns || [],
      };
    });

    let alphaSophiaSearched = false;
    let limitInfo: LimitCheck | null = null;

    const shouldSearchAlphaSophia = config.enabled && ALPHA_SOPHIA_API_KEY && (
      force_alpha_sophia || (candidates.length < config.min_local_threshold && offset === 0)
    );
    
    if (shouldSearchAlphaSophia) {
      if (user_id) {
        const { data: limitData } = await supabase.rpc('check_alpha_sophia_limit', { p_user_id: user_id });
        if (limitData && limitData.length > 0) limitInfo = limitData[0] as LimitCheck;
      }

      const canSearch = !user_id || !limitInfo || limitInfo.allowed;

      if (canSearch) {
        console.log(`Searching Alpha Sophia...`);
        alphaSophiaSearched = true;
        
        try {
          const searchLimit = Math.min(config.max_results_per_search, limitInfo?.remaining || config.max_results_per_search);
          const alphaSophiaCandidates = await searchAlphaSophia(ALPHA_SOPHIA_API_KEY, job.specialty, job.state, searchLimit);
          
          if (alphaSophiaCandidates.length > 0) {
            console.log(`Found ${alphaSophiaCandidates.length} Alpha Sophia candidates`);
            const existingIds = new Set(candidates.map(c => c.id));
            candidates = [...candidates, ...alphaSophiaCandidates.filter(c => !existingIds.has(c.id))];

            if (user_id) {
              await supabase.rpc('track_alpha_sophia_usage', {
                p_user_id: user_id, p_job_id: job_id,
                p_search_type: force_alpha_sophia ? 'manual' : 'auto',
                p_specialty: job.specialty, p_state: job.state,
                p_results_count: alphaSophiaCandidates.length, p_imports_count: 0,
              });
            }
          }
        } catch (asError) {
          console.error('Alpha Sophia search failed:', asError);
        }
      }
    }

    candidates.sort((a, b) => b.match_strength - a.match_strength);
    const paginatedCandidates = candidates.slice(offset, offset + limit);

    const summary = {
      total_matched: candidates.length,
      returned: paginatedCandidates.length,
      tier_breakdown: {
        a_tier: candidates.filter(c => c.unified_score.startsWith('A')).length,
        b_tier: candidates.filter(c => c.unified_score.startsWith('B')).length,
        c_tier: candidates.filter(c => c.unified_score.startsWith('C') || c.unified_score === 'D').length,
      },
      ready_to_contact: candidates.filter(c => c.has_personal_contact).length,
      needs_enrichment: candidates.filter(c => c.needs_enrichment).length,
      alpha_sophia_count: candidates.filter(c => c.source === 'alpha_sophia').length,
      alpha_sophia_searched: alphaSophiaSearched,
      ai_scored: aiScores.size > 0,
      alpha_sophia_limit: limitInfo ? {
        allowed: limitInfo.allowed, remaining: limitInfo.remaining,
        used_today: limitInfo.used_today, daily_limit: limitInfo.daily_limit, is_admin: limitInfo.is_admin,
      } : null,
    };

    return new Response(
      JSON.stringify({
        job: {
          id: job.id, name: job.job_name, facility: job.facility_name,
          specialty: job.specialty, location: `${job.city || ''}, ${job.state}`.replace(/^, /, ''),
          state: job.state, pay_rate: job.pay_rate, bill_rate: job.bill_rate,
        },
        summary,
        candidates: paginatedCandidates,
        config: { min_local_threshold: config.min_local_threshold, max_results_per_search: config.max_results_per_search },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Candidate Matcher error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
