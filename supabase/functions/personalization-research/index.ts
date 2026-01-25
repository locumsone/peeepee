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
  // Connection-based personalization
  connection?: ConnectionMatch | null;
  sms_hook?: string | null; // Ultra-compressed 40-char SMS hook
  // Structured research for database persistence
  structured_research?: {
    employer?: string;
    training?: string;
    credentials?: string;
    notable?: string;
  } | null;
  employer_researched?: string | null;
  training_researched?: string | null;
  credentials_researched?: string | null;
}

// ============================================
// CONNECTION-BASED PERSONALIZATION ENGINE
// ============================================

interface ConnectionMatch {
  priority: number;      // 1-8, lower = stronger
  fact: string;          // What we found about candidate
  benefit: string;       // Why this role fits them
  line: string;          // Full connection sentence for email
  smsLine: string;       // Compressed 40-char version for SMS
}

interface PlaybookContext {
  credentialing?: { days_to_credential?: number | null };
  compensation?: { hourly?: string | null };
  clinical?: { call_status?: string | null };
  position?: { trauma_level?: string | null; facility_type?: string | null };
}

/**
 * Connection Priority Engine - Maps candidate facts to role benefits
 * Returns the STRONGEST connection (lowest priority number wins)
 * 
 * Priority Order:
 * 1. State license → fastest start
 * 2. IMLC eligibility → expedited multi-state
 * 3. Trauma center → non-trauma lifestyle upgrade
 * 4. Academic → community simplicity
 * 5. Employed → locums premium
 * 6. Already local → no relocation
 * 7. Multi-state + zero call → sustainable locums
 * 8. Recent fellowship → board eligible accepted
 */
// Known trauma centers for detection (when research text doesn't mention "trauma")
const KNOWN_TRAUMA_CENTERS = [
  'grady', 'parkland', 'bellevue', 'cook county', 'jackson memorial', 
  'harborview', 'usc', 'ucla', 'keck', 'cedars-sinai', 'lax medical',
  'shock trauma', 'county usc', 'denver health', 'regional medical center',
  'memorial hermann', 'ben taub', 'r adams cowley', 'johns hopkins',
  'massachusetts general', 'brigham', 'umass', 'barnes jewish', 
  'northwestern memorial', 'rush', 'loyola', 'stroger', 'mount sinai',
  'ny presbyterian', 'nyu langone', 'kings county', 'jacobi', 'lincoln'
];

/**
 * Evaluate if two connections should be stacked
 * Stack when both are priority ≤ 4 (high-value connections)
 */
function evaluateStacking(connections: ConnectionMatch[]): boolean {
  if (connections.length < 2) return false;
  // Only stack if top 2 are both high-priority (≤4)
  return connections[0].priority <= 4 && connections[1].priority <= 4;
}

/**
 * Build a stacked opening line from two connections
 */
function buildStackedLine(conn1: ConnectionMatch, conn2: ConnectionMatch): string {
  // Format: "Your CA license means 40-day start. And you're already in LA—no relocation."
  const secondLine = conn2.line.charAt(0).toLowerCase() + conn2.line.slice(1);
  return `${conn1.line} And ${secondLine}`;
}

function buildStackedSmsLine(conn1: ConnectionMatch, conn2: ConnectionMatch): string {
  // Compress both into SMS-friendly format (max 60 chars)
  return `${conn1.smsLine} + ${conn2.smsLine}`.substring(0, 60);
}

function buildConnectionIcebreaker(
  candidate: Candidate, 
  job: JobContext, 
  research: string, 
  playbook: PlaybookContext | null
): ConnectionMatch | null {
  const connections: ConnectionMatch[] = [];
  
  const credDays = playbook?.credentialing?.days_to_credential || 40;
  const hourlyRate = playbook?.compensation?.hourly || '';
  const callStatus = playbook?.clinical?.call_status || '';
  const traumaLevel = playbook?.position?.trauma_level;
  const facilityType = playbook?.position?.facility_type || '';
  
  // Priority 1: State license (fastest start - most actionable)
  if (candidate.licenses?.some(l => l.toUpperCase() === job.state?.toUpperCase())) {
    connections.push({
      priority: 1,
      fact: `${job.state} license`,
      benefit: `${credDays}-day start`,
      line: `Your ${job.state} license means ${credDays}-day start vs 6+ months for out-of-state physicians.`,
      smsLine: `${job.state} license = ${credDays}-day start.`
    });
  }
  
  // Priority 2: IMLC membership (expedited multi-state)
  if ((candidate.licenses?.length || 0) >= 10) {
    connections.push({
      priority: 2,
      fact: 'IMLC eligibility',
      benefit: 'priority credentialing',
      line: `Your IMLC eligibility = priority credentialing in ${job.state} and surrounding states.`,
      smsLine: `IMLC = priority cred.`
    });
  }
  
  // Priority 3: Trauma center -> Non-trauma (lifestyle upgrade)
  // Check both research text AND known trauma center names
  const candidateEmployer = (candidate.company_name || '').toLowerCase();
  const researchText = (research || '').toLowerCase();
  
  const worksAtTrauma = 
    researchText.includes('trauma') || 
    researchText.includes('level i') ||
    researchText.includes('level ii') ||
    researchText.includes('level 1') ||
    researchText.includes('level 2') ||
    KNOWN_TRAUMA_CENTERS.some(name => 
      candidateEmployer.includes(name) || researchText.includes(name)
    );
    
  if (worksAtTrauma && (traumaLevel === 'None' || traumaLevel?.toLowerCase() === 'non-trauma')) {
    connections.push({
      priority: 3,
      fact: 'trauma center experience',
      benefit: 'non-trauma pace',
      line: `After trauma center intensity, a non-trauma ${callStatus || 'schedule'} with ${hourlyRate || 'premium'} compensation could be refreshing.`,
      smsLine: `Non-trauma pace after trauma.`
    });
  }
  
  // Priority 4: Academic -> Community simplicity
  const worksAcademic = researchText.includes('academic') ||
                        researchText.includes('teaching') ||
                        researchText.includes('university') ||
                        candidateEmployer.includes('university') ||
                        candidateEmployer.includes('academic');
  if (worksAcademic && facilityType?.toLowerCase().includes('community')) {
    connections.push({
      priority: 4,
      fact: 'academic center experience',
      benefit: 'community hospital simplicity',
      line: `After academic bureaucracy, community hospital pace might feel refreshing.`,
      smsLine: `Community pace, no academic red tape.`
    });
  }
  
  // Priority 5: Currently employed -> Locums pays more
  if (candidate.company_name && hourlyRate) {
    connections.push({
      priority: 5,
      fact: 'employed position',
      benefit: 'locums premium',
      line: `Your employed ${candidate.specialty || 'physician'} skills are worth ${hourlyRate}/hr in locums—currently capturing that?`,
      smsLine: `${hourlyRate}/hr for your skills.`
    });
  }
  
  // Priority 6: Already local (no relocation) - check both state AND city
  const isLocalState = candidate.state?.toUpperCase() === job.state?.toUpperCase();
  const isLocalCity = candidate.city?.toLowerCase() === job.city?.toLowerCase();
  
  if ((isLocalState || isLocalCity) && candidate.city) {
    connections.push({
      priority: 6,
      fact: 'already local',
      benefit: 'no relocation',
      line: `You're already in ${candidate.city}—no relocation, just ${hourlyRate || 'better'} compensation.`,
      smsLine: `Already in ${candidate.city}, no relocation.`
    });
  }
  
  // Priority 7: Multi-state + zero call (sustainable locums)
  if ((candidate.licenses?.length || 0) >= 5 && callStatus?.toLowerCase().includes('no call')) {
    connections.push({
      priority: 7,
      fact: 'multi-state licensure',
      benefit: 'sustainable locums',
      line: `Your locums flexibility + this zero-call setup = sustainable long-term.`,
      smsLine: `Flexibility + zero call.`
    });
  }
  
  // Priority 8: Recent fellowship grad -> Board Eligible accepted
  const recentFellow = researchText.includes('fellow') ||
                       researchText.includes('recently completed') ||
                       researchText.includes('just finished');
  if (recentFellow) {
    connections.push({
      priority: 8,
      fact: 'recent fellowship',
      benefit: 'board eligible accepted',
      line: `Board Eligible accepted—you don't have to wait for certification to start earning ${hourlyRate || 'top'}/hr.`,
      smsLine: `BE accepted. Start now.`
    });
  }
  
  // Sort by priority (lower = stronger)
  if (connections.length > 0) {
    connections.sort((a, b) => a.priority - b.priority);
    
    // Check for stacking (2+ high-priority connections)
    if (evaluateStacking(connections)) {
      const stacked: ConnectionMatch = {
        priority: connections[0].priority, // Keep best priority
        fact: `${connections[0].fact} + ${connections[1].fact}`,
        benefit: `${connections[0].benefit} + ${connections[1].benefit}`,
        line: buildStackedLine(connections[0], connections[1]),
        smsLine: buildStackedSmsLine(connections[0], connections[1]),
      };
      console.log(`📊 STACKED connections: P${connections[0].priority} (${connections[0].fact}) + P${connections[1].priority} (${connections[1].fact})`);
      return stacked;
    }
    
    return connections[0];
  }
  
  return null; // No valid connection - skip personalization
}

// ============================================
// RESEARCH FUNCTIONS
// ============================================

// Research a candidate using Perplexity web search - OPTIMIZED for quality + speed
async function deepResearchCandidate(
  perplexityKey: string,
  candidate: Candidate,
  job: JobContext
): Promise<{ summary: string; sources: string[]; details: any }> {
  
  try {
    const nameQuery = `Dr. ${candidate.first_name} ${candidate.last_name}`;
    const specialtyInfo = candidate.specialty ? `${candidate.specialty} physician` : 'physician';
    const locationInfo = candidate.state ? `practicing in ${candidate.state}` : '';
    const npiInfo = candidate.npi ? `NPI: ${candidate.npi}` : '';
    const employerInfo = candidate.company_name ? `affiliated with ${candidate.company_name}` : '';
    
    const searchQuery = [nameQuery, specialtyInfo, locationInfo, employerInfo, npiInfo]
      .filter(Boolean)
      .join(', ');

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a healthcare recruiter researching a physician for personalized outreach. Search for SPECIFIC, VERIFIABLE facts about this doctor. 

REQUIRED OUTPUT FORMAT:
1. EMPLOYER: Current hospital/health system affiliation (e.g., "Works at Memorial Hermann Hospital")
2. TRAINING: Fellowship/residency program and institution (e.g., "Completed IR fellowship at Johns Hopkins")
3. CREDENTIALS: Board certifications, specializations (e.g., "Board certified in Interventional Radiology")
4. NOTABLE: Publications, research, leadership roles, awards

Be SPECIFIC - name institutions, dates, and achievements. If you cannot find specific information for a category, skip it entirely rather than being vague. Do NOT make up information. Max 4 sentences total, focused on the most impressive/relevant findings.`
          },
          {
            role: 'user',
            content: searchQuery
          }
        ],
        temperature: 0.1,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return { summary: '', sources: [], details: {} };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    const parsed = parseStructuredResearch(content);
    
    const details = {
      fellowship: parsed.training || extractSection(content, ['fellowship', 'training', 'residency']),
      employer: parsed.employer || extractSection(content, ['hospital', 'employer', 'works at', 'affiliated', 'practicing at']),
      certifications: parsed.credentials || extractSection(content, ['board certified', 'certification', 'diplomate']),
      publications: parsed.notable || extractSection(content, ['published', 'research', 'author']),
      structured: parsed,
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

function parseStructuredResearch(summary: string): {
  employer?: string;
  training?: string;
  credentials?: string;
  notable?: string;
} {
  const result: { employer?: string; training?: string; credentials?: string; notable?: string } = {};
  
  if (!summary) return result;
  
  const patterns = [
    { key: 'employer' as const, regex: /\*\*EMPLOYER\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'training' as const, regex: /\*\*TRAINING\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'credentials' as const, regex: /\*\*CREDENTIALS\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'notable' as const, regex: /\*\*NOTABLE\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
  ];
  
  for (const { key, regex } of patterns) {
    const match = summary.match(regex);
    if (match && match[1]) {
      let value = match[1].trim();
      value = value.replace(/\[\d+\]/g, '').trim();
      value = value.replace(/^\d+\.\s*/, '');
      if (value.length > 10) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

function extractSection(text: string, keywords: string[]): string | null {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const idx = lowerText.indexOf(keyword);
    if (idx !== -1) {
      const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
      const end = text.indexOf('.', idx + keyword.length);
      if (end > start) {
        return text.substring(start, end + 1).trim();
      }
    }
  }
  return null;
}

// ============================================
// HOOK & ICEBREAKER GENERATION
// ============================================

// Fast hook builder - uses PAY RATE (what candidate receives), not bill rate
function buildQuickHook(candidate: Candidate, job: JobContext, research: string, connection: ConnectionMatch | null): string {
  // Use connection-based hook if available
  if (connection) {
    return `Dr. ${candidate.last_name}, ${connection.line}`;
  }
  
  // Fallback to generic (but still useful) hook
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  const rate = candidateRate ? `$${candidateRate}/hour` : 'competitive rate';
  
  return `Your ${candidate.specialty || 'medical'} background aligns with our ${job.specialty} opportunity at ${job.facility_name}. ${rate}, ${job.city}, ${job.state}.`;
}

// Build connection-based icebreaker or fallback to short-form
function buildIcebreaker(candidate: Candidate, job: JobContext, connection: ConnectionMatch | null): string {
  if (connection) {
    return `Dr. ${candidate.last_name}, ${connection.line}`;
  }
  
  // Short-form fallback - no forced personalization
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  const rateStr = candidateRate ? ` - $${candidateRate}/hr` : '';
  
  return `Dr. ${candidate.last_name}, ${job.specialty} ${job.facility_name ? `at ${job.facility_name}` : ''} in ${job.city}, ${job.state}${rateStr}.`;
}

// Fast talking points without AI - uses PAY RATE
function buildQuickTalkingPoints(candidate: Candidate, job: JobContext, connection: ConnectionMatch | null): string[] {
  const points: string[] = [];
  
  // Lead with connection benefit if available
  if (connection) {
    points.push(`${connection.fact} → ${connection.benefit}`);
  }
  
  const candidateRate = job.pay_rate || (job.bill_rate ? Math.round(job.bill_rate * 0.73) : null);
  if (candidateRate) points.push(`$${candidateRate}/hour - locums rate`);
  if (job.facility_name) points.push(`${job.facility_name} - ${job.city}, ${job.state}`);
  
  const hasStateLicense = candidate.licenses?.some(l => l.toUpperCase() === job.state?.toUpperCase());
  if (hasStateLicense) {
    points.push(`Already licensed in ${job.state} - expedited credentialing`);
  } else if ((candidate.licenses?.length || 0) >= 10) {
    points.push(`Multi-state licensure - IMLC eligible for faster start`);
  }
  
  return points.slice(0, 4);
}

// ============================================
// CANDIDATE PROCESSING
// ============================================

async function processCandidate(
  candidate: Candidate,
  job: JobContext,
  perplexityKey: string | undefined,
  lovableKey: string | undefined,
  useDeepResearch: boolean,
  playbook: PlaybookContext | null
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

  // === CONNECTION-BASED PERSONALIZATION ===
  const connection = buildConnectionIcebreaker(candidate, job, researchSummary, playbook);
  
  if (connection) {
    console.log(`✅ Connection found for ${candidate.last_name}: Priority ${connection.priority} - ${connection.fact}`);
  } else {
    console.log(`⚠️ No connection for ${candidate.last_name} - using short-form fallback`);
  }

  // Build hook and icebreaker using connection
  const hook = buildQuickHook(candidate, job, researchSummary, connection);
  const icebreaker = buildIcebreaker(candidate, job, connection);
  const talking_points = buildQuickTalkingPoints(candidate, job, connection);

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (connection && connection.priority <= 3) {
    confidence = 'high';
  } else if (connection) {
    confidence = 'medium';
  } else if (researchDetails?.fellowship || researchDetails?.employer) {
    confidence = 'medium';
  }

  return {
    candidate_id: candidate.id,
    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
    personalization_hook: hook,
    hook_type: connection ? `connection_p${connection.priority}` : 'short_form',
    confidence,
    research_sources: researchSources,
    talking_points,
    icebreaker,
    research_summary: researchSummary || undefined,
    connection,
    sms_hook: connection?.smsLine || null,
    structured_research: researchDetails?.structured || null,
    employer_researched: researchDetails?.employer || null,
    training_researched: researchDetails?.fellowship || null,
    credentials_researched: researchDetails?.certifications || null,
  };
}

async function processCandidatesInBatches(
  candidates: Candidate[],
  job: JobContext,
  perplexityKey: string | undefined,
  lovableKey: string | undefined,
  useDeepResearch: boolean,
  playbook: PlaybookContext | null,
  batchSize: number = 5
): Promise<PersonalizationResult[]> {
  const results: PersonalizationResult[] = [];
  
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidates.length / batchSize)} (${batch.length} candidates)`);
    
    const batchPromises = batch.map(candidate => 
      processCandidate(candidate, job, perplexityKey, lovableKey, useDeepResearch, playbook)
        .catch(error => {
          console.error(`Error processing ${candidate.first_name} ${candidate.last_name}:`, error);
          return {
            candidate_id: candidate.id,
            candidate_name: `${candidate.first_name} ${candidate.last_name}`,
            personalization_hook: `${job.specialty} opportunity at ${job.facility_name}, ${job.city}, ${job.state}.`,
            hook_type: 'error_fallback',
            confidence: 'low' as const,
            research_sources: [],
            talking_points: ['Competitive compensation', 'Excellent facility'],
            icebreaker: `Dr. ${candidate.last_name}, ${job.specialty} at ${job.facility_name}.`,
            connection: null,
            sms_hook: null,
          };
        })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// ============================================
// MAIN SERVER
// ============================================

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
      force_refresh = false,
      custom_playbook,
      playbook_data, // NEW: Accept playbook data directly from frontend
      batch_size = 5
    } = await req.json();

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      throw new Error('candidate_ids array is required');
    }
    if (!job_id) {
      throw new Error('job_id is required');
    }

    const MAX_CANDIDATES = 20;
    const limitedCandidateIds = candidate_ids.slice(0, MAX_CANDIDATES);
    const wasLimited = candidate_ids.length > MAX_CANDIDATES;
    
    if (wasLimited) {
      console.log(`Limited from ${candidate_ids.length} to ${MAX_CANDIDATES} candidates`);
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

    // Get playbook context (from request or campaign)
    let playbookContext: PlaybookContext | null = null;
    
    if (playbook_data) {
      playbookContext = playbook_data;
      console.log("Using playbook_data from request");
    } else {
      // Try to fetch from campaign
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('playbook_data')
        .eq('job_id', job_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (campaigns?.[0]?.playbook_data) {
        playbookContext = campaigns[0].playbook_data as PlaybookContext;
        console.log("Using playbook from campaign");
      }
    }

    // Fetch candidates
    const { data: candidatesData, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, specialty, state, city, company_name, licenses, npi, graduation_year, board_certifications, enrichment_tier')
      .in('id', limitedCandidateIds);

    if (candidatesError || !candidatesData) {
      throw new Error('Failed to fetch candidates');
    }

    // Check for existing research (cache check)
    const [matchesResult, researchResult] = await Promise.all([
      supabase
        .from('candidate_job_matches')
        .select('candidate_id, icebreaker, talking_points, match_reasons, match_concerns')
        .eq('job_id', job_id)
        .in('candidate_id', limitedCandidateIds),
      supabase
        .from('candidate_research')
        .select('candidate_id, credentials_summary, professional_highlights, verified_specialty, has_imlc, verified_licenses')
        .in('candidate_id', limitedCandidateIds)
    ]);

    const existingMatches = matchesResult.data;
    const existingResearch = researchResult.data;
    
    const researchMap = new Map<string, any>();
    if (existingResearch) {
      for (const research of existingResearch) {
        researchMap.set(research.candidate_id, research);
      }
    }

    const alreadyResearchedMap = new Map<string, { 
      icebreaker: string; 
      talking_points: string[];
      match_reasons?: string[];
      research?: any;
      has_deep_research?: boolean;
    }>();
    
    if (!force_refresh && existingMatches) {
      for (const match of existingMatches) {
        const icebreakerIsSubstantial = match.icebreaker && match.icebreaker.length > 60;
        const hasQualityData = match.talking_points && match.talking_points.length > 0;
        
        const shouldCache = deep_research 
          ? (icebreakerIsSubstantial && hasQualityData)
          : (match.icebreaker && hasQualityData);
          
        if (shouldCache) {
          alreadyResearchedMap.set(match.candidate_id, {
            icebreaker: match.icebreaker,
            talking_points: match.talking_points,
            match_reasons: match.match_reasons,
            research: researchMap.get(match.candidate_id),
            has_deep_research: icebreakerIsSubstantial
          });
        }
      }
    }
    
    console.log(`force_refresh=${force_refresh}, deep_research=${deep_research}, cached=${alreadyResearchedMap.size}/${limitedCandidateIds.length}`);

    const candidatesNeedingResearch = candidatesData.filter(c => !alreadyResearchedMap.has(c.id));
    const cachedResults: (PersonalizationResult & { from_cache?: boolean })[] = candidatesData
      .filter(c => alreadyResearchedMap.has(c.id))
      .map(c => {
        const cached = alreadyResearchedMap.get(c.id)!;
        const research = cached.research;
        
        let researchSummary = '';
        if (research?.professional_highlights && research.professional_highlights.length > 0) {
          researchSummary = research.professional_highlights.slice(0, 3).join(' ');
        }
        
        // Try to extract connection from cached icebreaker
        const connection = buildConnectionIcebreaker(c, job, researchSummary, playbookContext);
        
        return {
          candidate_id: c.id,
          candidate_name: `${c.first_name} ${c.last_name}`,
          personalization_hook: cached.icebreaker,
          hook_type: connection ? `cached_connection_p${connection.priority}` : 'cached',
          confidence: 'high' as const,
          research_sources: [],
          talking_points: cached.talking_points,
          icebreaker: cached.icebreaker,
          research_summary: researchSummary || undefined,
          connection,
          sms_hook: connection?.smsLine || null,
          from_cache: true,
        };
      });

    if (candidatesNeedingResearch.length === 0) {
      console.log(`All ${limitedCandidateIds.length} candidates already have research cached`);
      return new Response(
        JSON.stringify({
          success: true,
          results: cachedResults,
          deep_research_used: false,
          total_candidates: cachedResults.length,
          from_cache: cachedResults.length,
          was_limited: wasLimited,
          original_count: candidate_ids.length,
          high_confidence: cachedResults.filter(r => r.confidence === 'high').length,
          medium_confidence: cachedResults.filter(r => r.confidence === 'medium').length,
          low_confidence: cachedResults.filter(r => r.confidence === 'low').length,
          connection_stats: {
            with_connection: cachedResults.filter(r => r.connection).length,
            without_connection: cachedResults.filter(r => !r.connection).length,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${candidatesNeedingResearch.length} candidates (${cachedResults.length} from cache)`);

    const useDeepResearch = deep_research && !!PERPLEXITY_API_KEY;
    const effectiveBatchSize = useDeepResearch ? Math.min(batch_size, 3) : batch_size;
    
    const newResults = await processCandidatesInBatches(
      candidatesNeedingResearch,
      job,
      PERPLEXITY_API_KEY,
      LOVABLE_API_KEY,
      useDeepResearch,
      playbookContext,
      effectiveBatchSize
    );

    const allResults = [...newResults, ...cachedResults];

    // Store results in database
    const upsertPromises = newResults.map(async (result: PersonalizationResult) => {
      try {
        console.log(`Saving research for ${result.candidate_id}: connection=${result.connection?.fact || 'none'}`);
        
        const { error } = await supabase.rpc('upsert_candidate_job_match', {
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
        }
        
        if (result.structured_research || result.research_summary) {
          const structured = result.structured_research || {};
          const highlights: string[] = [];
          if (structured.employer) highlights.push(structured.employer);
          if (structured.training) highlights.push(structured.training);
          if (structured.credentials) highlights.push(structured.credentials);
          if (structured.notable) highlights.push(structured.notable);
          
          await supabase
            .from('candidate_research')
            .upsert({
              candidate_id: result.candidate_id,
              credentials_summary: structured.credentials || null,
              professional_highlights: highlights.length > 0 ? highlights : null,
              research_source: 'perplexity_deep',
              research_confidence: result.confidence,
              last_researched_at: new Date().toISOString(),
            }, {
              onConflict: 'candidate_id',
              ignoreDuplicates: false
            });
        }
      } catch (e) {
        console.error('Failed to upsert match:', e);
      }
    });
    
    await Promise.all(upsertPromises);

    console.log(`Generated ${newResults.length} new hooks, ${cachedResults.length} from cache`);
    
    // Connection stats
    const withConnection = allResults.filter(r => r.connection).length;
    const withoutConnection = allResults.filter(r => !r.connection).length;
    console.log(`Connection stats: ${withConnection} with connection, ${withoutConnection} using short-form`);

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
        low_confidence: allResults.filter((r: PersonalizationResult) => r.confidence === 'low').length,
        connection_stats: {
          with_connection: withConnection,
          without_connection: withoutConnection,
        }
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
