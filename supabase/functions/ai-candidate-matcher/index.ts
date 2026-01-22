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
}

interface AlphaSophiaHCP {
  id: string;
  npi: string;
  name: string;
  taxonomy?: {
    code: string;
    description: string;
  };
  licensure?: string[];
  contact?: {
    email?: string[];
    phone?: string[];
  };
  location?: {
    city: string;
    state: string;
  };
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ALPHA_SOPHIA_API_KEY = Deno.env.get('ALPHA_SOPHIA_API_KEY');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { job_id, limit = 25, offset = 0, force_alpha_sophia = false, user_id = null } = await req.json();
    
    if (!job_id) {
      throw new Error('job_id is required');
    }

    console.log(`Matching candidates for job: ${job_id}, limit: ${limit}, offset: ${offset}, force_alpha_sophia: ${force_alpha_sophia}`);

    // Fetch Alpha Sophia config
    const { data: configData } = await supabase
      .from('alpha_sophia_config')
      .select('*')
      .limit(1)
      .single();
    
    const config: AlphaSophiaConfig = configData || {
      min_local_threshold: 15,
      max_results_per_search: 50,
      daily_limit: 500,
      admin_daily_limit: 2000,
      cost_per_lookup: 0.05,
      enabled: true,
    };

    // Fetch job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_name, facility_name, specialty, city, state, pay_rate, bill_rate')
      .eq('id', job_id)
      .single();

    if (jobError || !jobData) {
      throw new Error(`Job not found: ${job_id}`);
    }

    const job = jobData as JobData;
    console.log(`Job: ${job.job_name} - ${job.specialty} in ${job.state}`);

    // Call the database function for local candidate matching
    const { data: localCandidates, error: matchError } = await supabase
      .rpc('campaign_candidate_search', { p_job_id: job_id });

    if (matchError) {
      console.error('Database match error:', matchError);
      throw new Error('Failed to search candidates');
    }

    const dbCandidates = (localCandidates || []) as DbCandidate[];
    console.log(`Found ${dbCandidates.length} local candidates`);

    // Enriched sources that indicate personal contact info (not just company phones)
    const ENRICHED_SOURCES = ['Whitepages', 'PDL', 'Apollo', 'Hunter', 'Clearbit', 'ZoomInfo'];
    
    // Transform database candidates to output format
    let candidates: OutputCandidate[] = dbCandidates.map((c) => {
      // Check if this candidate was enriched by a real data provider
      const isEnriched = !!c.enrichment_source && ENRICHED_SOURCES.includes(c.enrichment_source);
      
      return {
        id: c.id,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        specialty: c.specialty || '',
        state: c.state || '',
        city: c.city || undefined,
        unified_score: c.unified_score,
        match_strength: calculateMatchStrength(c.unified_score, c.score_sort),
        licenses: c.licenses || [],
        licenses_count: c.license_count || 0,
        enrichment_tier: c.enrichment_tier || 'Basic',
        enrichment_source: c.enrichment_source || undefined,
        score_reason: generateScoreReason(c, job),
        icebreaker: generateIcebreaker(c, job),
        talking_points: generateTalkingPoints(c, job),
        has_personal_contact: c.has_personal_contact,
        needs_enrichment: c.needs_enrichment,
        is_enriched: isEnriched,
        work_email: c.email || undefined,
        work_phone: c.phone || undefined,
        personal_mobile: c.personal_mobile || undefined,
        personal_email: c.personal_email || undefined,
        source: 'database',
      };
    });

    let alphaSophiaCount = 0;
    let alphaSophiaSearched = false;
    let limitInfo: LimitCheck | null = null;

    // Check if we should search Alpha Sophia
    const shouldSearchAlphaSophia = config.enabled && ALPHA_SOPHIA_API_KEY && (
      force_alpha_sophia || 
      (candidates.length < config.min_local_threshold && offset === 0)
    );
    
    if (shouldSearchAlphaSophia) {
      // Check user's daily limit
      if (user_id) {
        const { data: limitData } = await supabase.rpc('check_alpha_sophia_limit', { p_user_id: user_id });
        if (limitData && limitData.length > 0) {
          limitInfo = limitData[0] as LimitCheck;
        }
      }

      const canSearch = !user_id || !limitInfo || limitInfo.allowed;

      if (canSearch) {
        console.log(`Searching Alpha Sophia (force: ${force_alpha_sophia}, local count: ${candidates.length}, threshold: ${config.min_local_threshold})...`);
        alphaSophiaSearched = true;
        
        try {
          const searchLimit = Math.min(
            config.max_results_per_search,
            limitInfo?.remaining || config.max_results_per_search
          );

          const alphaSophiaCandidates = await searchAlphaSophia(
            ALPHA_SOPHIA_API_KEY,
            job.specialty,
            job.state,
            searchLimit
          );
          
          if (alphaSophiaCandidates.length > 0) {
            console.log(`Found ${alphaSophiaCandidates.length} Alpha Sophia candidates`);
            alphaSophiaCount = alphaSophiaCandidates.length;
            
            // Filter out duplicates based on NPI if we have it in database
            const existingIds = new Set(candidates.map(c => c.id));
            const newCandidates = alphaSophiaCandidates.filter(c => !existingIds.has(c.id));
            
            candidates = [...candidates, ...newCandidates];
            console.log(`Total candidates after Alpha Sophia: ${candidates.length}`);

            // Track usage
            if (user_id) {
              await supabase.rpc('track_alpha_sophia_usage', {
                p_user_id: user_id,
                p_job_id: job_id,
                p_search_type: force_alpha_sophia ? 'manual' : 'auto',
                p_specialty: job.specialty,
                p_state: job.state,
                p_results_count: alphaSophiaCandidates.length,
                p_imports_count: 0,
              });
            }
          }
        } catch (asError) {
          console.error('Alpha Sophia search failed:', asError);
          // Continue with local results only
        }
      } else {
        console.log(`Alpha Sophia search blocked: daily limit reached (${limitInfo?.used_today}/${limitInfo?.daily_limit})`);
      }
    }

    // Sort by match strength
    candidates.sort((a, b) => b.match_strength - a.match_strength);

    // Apply pagination
    const paginatedCandidates = candidates.slice(offset, offset + limit);

    // Calculate summary
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
      alpha_sophia_limit: limitInfo ? {
        allowed: limitInfo.allowed,
        remaining: limitInfo.remaining,
        used_today: limitInfo.used_today,
        daily_limit: limitInfo.daily_limit,
        is_admin: limitInfo.is_admin,
      } : null,
    };

    return new Response(
      JSON.stringify({
        job: {
          id: job.id,
          name: job.job_name,
          facility: job.facility_name,
          specialty: job.specialty,
          location: `${job.city || ''}, ${job.state}`.replace(/^, /, ''),
          state: job.state,
          pay_rate: job.pay_rate,
          bill_rate: job.bill_rate,
        },
        summary,
        candidates: paginatedCandidates,
        config: {
          min_local_threshold: config.min_local_threshold,
          max_results_per_search: config.max_results_per_search,
        },
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

// Calculate match strength (0-100) based on unified score
function calculateMatchStrength(unifiedScore: string, scoreSort: number): number {
  const scoreMap: Record<string, number> = {
    'A+': 98, 'A': 95, 'A-': 90,
    'B+': 85, 'B': 80, 'B-': 75,
    'C+': 70, 'C': 65, 'C-': 60,
    'D': 50,
  };
  return scoreMap[unifiedScore] || 50;
}

// Generate score reason based on candidate attributes
function generateScoreReason(candidate: DbCandidate, job: JobData): string {
  const reasons: string[] = [];
  
  if (candidate.licenses?.includes(job.state)) {
    reasons.push(`Licensed in ${job.state}`);
  }
  
  if (candidate.license_count >= 10) {
    reasons.push(`${candidate.license_count} state licenses`);
  } else if (candidate.license_count >= 5) {
    reasons.push(`Multi-state licensed (${candidate.license_count})`);
  }
  
  if (candidate.enrichment_tier === 'Platinum') {
    reasons.push('Highly engaged candidate');
  } else if (candidate.enrichment_tier === 'Gold') {
    reasons.push('Well-qualified profile');
  }
  
  if (candidate.specialty?.toLowerCase() === job.specialty?.toLowerCase()) {
    reasons.push(`Exact ${job.specialty} match`);
  }
  
  return reasons.join(' • ') || 'Matches job requirements';
}

// Generate icebreaker for outreach
function generateIcebreaker(candidate: DbCandidate, job: JobData): string {
  const name = candidate.first_name || 'there';
  const specialty = job.specialty || 'healthcare';
  const location = job.city ? `${job.city}, ${job.state}` : job.state;
  
  return `Hi ${name}, I came across your profile and thought you'd be a great fit for a ${specialty} opportunity in ${location}.`;
}

// Generate talking points
function generateTalkingPoints(candidate: DbCandidate, job: JobData): string[] {
  const points: string[] = [];
  
  if (candidate.licenses?.includes(job.state)) {
    points.push(`Already licensed in ${job.state} - can start quickly`);
  }
  
  if (job.pay_rate) {
    points.push(`Competitive pay rate: $${job.pay_rate}/hr`);
  }
  
  if (job.facility_name) {
    points.push(`Position at ${job.facility_name}`);
  }
  
  if (candidate.license_count > 5) {
    points.push('Flexible for multi-state assignments');
  }
  
  return points.length > 0 ? points : ['Great opportunity matching your specialty'];
}

// Search Alpha Sophia for additional candidates
async function searchAlphaSophia(
  apiKey: string,
  specialty: string,
  state: string,
  pageSize: number
): Promise<OutputCandidate[]> {
  const queryParams = new URLSearchParams();
  queryParams.set('pageSize', String(Math.min(pageSize, 100)));
  queryParams.set('page', '1');
  
  if (state) {
    queryParams.set('state', `+${state}`);
  }
  
  if (specialty) {
    queryParams.set('taxonomy', `+"${specialty}"`);
  }
  
  // Only get providers with contact info
  queryParams.set('contact', 'email');
  
  console.log('Alpha Sophia query:', queryParams.toString());
  
  const response = await fetch(
    `https://api.alphasophia.com/v1/search/hcp?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
    }
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
      unified_score: 'B', // External candidates get B-tier by default
      match_strength: 75,
      licenses: hcp.licensure || [],
      licenses_count: hcp.licensure?.length || 0,
      enrichment_tier: 'Alpha Sophia',
      score_reason: 'External healthcare provider database match',
      icebreaker: `Hi ${firstName}, I found your profile on Alpha Sophia and thought you'd be a great fit.`,
      talking_points: [
        `Licensed in ${hcp.licensure?.length || 0} states`,
        'Contact information verified',
      ],
      has_personal_contact: !!(hcp.contact?.email?.length || hcp.contact?.phone?.length),
      needs_enrichment: false,
      work_email: hcp.contact?.email?.[0] || undefined,
      work_phone: hcp.contact?.phone?.[0] || undefined,
      source: 'alpha_sophia',
    };
  });
}