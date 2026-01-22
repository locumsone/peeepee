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

// Research a candidate using Perplexity web search
async function deepResearchCandidate(
  perplexityKey: string,
  candidate: Candidate,
  job: JobContext
): Promise<{ summary: string; sources: string[]; details: any }> {
  const searchQuery = `${candidate.first_name} ${candidate.last_name} physician ${candidate.specialty || ''} ${candidate.state || ''} fellowship training hospital`;
  
  try {
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
            content: `You are researching a physician candidate for a healthcare recruiting firm. 
Find specific, verifiable professional information that can be used for personalized outreach.

Focus on:
1. Fellowship training institution and specialty
2. Current or recent employer/hospital
3. Board certifications and credentials
4. Publications or presentations
5. Professional memberships or leadership roles
6. Any unique professional accomplishments

Return ONLY factual, verifiable information. Do NOT make up details.
If you cannot find specific information, say "No specific information found" for that category.`
          },
          {
            role: 'user',
            content: `Research Dr. ${candidate.first_name} ${candidate.last_name}, a ${candidate.specialty || 'physician'} ${candidate.state ? `in ${candidate.state}` : ''}.
${candidate.company_name ? `Current employer: ${candidate.company_name}` : ''}
${candidate.npi ? `NPI: ${candidate.npi}` : ''}
${candidate.graduation_year ? `Graduation year: ${candidate.graduation_year}` : ''}

Find their professional background for recruiting outreach.`
          }
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return { summary: '', sources: [], details: {} };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Parse the research into structured details
    const details = {
      fellowship: extractSection(content, ['fellowship', 'training', 'residency']),
      employer: extractSection(content, ['hospital', 'employer', 'works at', 'affiliated']),
      certifications: extractSection(content, ['board certified', 'certification', 'credentials']),
      publications: extractSection(content, ['publication', 'research', 'published']),
      leadership: extractSection(content, ['leadership', 'director', 'chief', 'president']),
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

// Generate personalized hook using AI
async function generatePersonalizedHook(
  lovableKey: string,
  candidate: Candidate,
  job: JobContext,
  hookPattern: { type: string; pattern: string },
  researchSummary: string
): Promise<{ hook: string; icebreaker: string; talking_points: string[] }> {
  const systemPrompt = `You are an expert healthcare recruiter creating hyper-personalized outreach.

Your task: Generate a compelling, personalized outreach hook for a physician candidate.

CRITICAL RULES:
1. Use SPECIFIC details from the research - fellowship institution, current employer, publications
2. Never use generic phrases like "your background caught our attention" unless NO specific details exist
3. Lead with what makes THIS candidate special for THIS specific opportunity
4. Reference the hook pattern provided but customize with real details
5. Keep the hook under 100 words - punchy and specific
6. Generate 3-4 specific talking points the recruiter can use

Hook Pattern to Follow: ${hookPattern.type}
Pattern Template: ${hookPattern.pattern}`;

  const userPrompt = `
CANDIDATE:
Name: Dr. ${candidate.first_name} ${candidate.last_name}
Specialty: ${candidate.specialty || 'Unknown'}
Location: ${candidate.city || ''}, ${candidate.state || 'Unknown'}
Current Employer: ${candidate.company_name || 'Unknown'}
Licenses: ${(candidate.licenses || []).join(', ') || 'Unknown'}
Board Certifications: ${(candidate.board_certifications || []).join(', ') || 'Unknown'}

RESEARCH FINDINGS:
${researchSummary || 'No specific research available'}

JOB OPPORTUNITY:
Specialty: ${job.specialty}
Facility: ${job.facility_name}
Location: ${job.city}, ${job.state}
Rate: $${job.bill_rate}/hour
${job.raw_job_text ? `\nAdditional Details:\n${job.raw_job_text.substring(0, 1500)}` : ''}

Generate the personalized hook, icebreaker, and talking points.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
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
            name: "generate_personalization",
            description: "Generate personalized outreach content",
            parameters: {
              type: "object",
              properties: {
                hook: { 
                  type: "string", 
                  description: "Main personalization hook - specific, compelling, under 100 words" 
                },
                icebreaker: { 
                  type: "string", 
                  description: "Opening line for email/call - warm, specific reference to their background" 
                },
                talking_points: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "3-4 key selling points tailored to this candidate" 
                }
              },
              required: ["hook", "icebreaker", "talking_points"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_personalization" } }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return {
        hook: parsed.hook || '',
        icebreaker: parsed.icebreaker || `Hi Dr. ${candidate.last_name},`,
        talking_points: parsed.talking_points || []
      };
    }
  } catch (error) {
    console.error('AI generation error:', error);
  }

  // Fallback
  return {
    hook: `Your background in ${candidate.specialty || 'medicine'} aligns with our ${job.specialty} opportunity at ${job.facility_name} in ${job.city}, ${job.state}. $${job.bill_rate}/hour, long-term locums.`,
    icebreaker: `Hi Dr. ${candidate.last_name},`,
    talking_points: [
      `$${job.bill_rate}/hour compensation`,
      `${job.facility_name} - excellent resources`,
      `Long-term stability with locums flexibility`
    ]
  };
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
      custom_playbook 
    } = await req.json();

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      throw new Error('candidate_ids array is required');
    }
    if (!job_id) {
      throw new Error('job_id is required');
    }

    console.log(`Personalization research for ${candidate_ids.length} candidates, deep_research=${deep_research}`);

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
      raw_job_text: jobData.raw_job_text,
      personalization_playbook: custom_playbook || jobData.personalization_playbook
    };

    // Fetch candidates
    const { data: candidatesData, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, specialty, state, city, company_name, licenses, npi, graduation_year, board_certifications, enrichment_tier')
      .in('id', candidate_ids);

    if (candidatesError || !candidatesData) {
      throw new Error('Failed to fetch candidates');
    }

    const results: PersonalizationResult[] = [];
    const useDeepResearch = deep_research && !!PERPLEXITY_API_KEY;

    for (const candidate of candidatesData) {
      let researchSummary = '';
      let researchSources: string[] = [];
      let researchDetails: any = {};

      // Deep research with Perplexity if enabled
      if (useDeepResearch) {
        console.log(`Deep researching: ${candidate.first_name} ${candidate.last_name}`);
        const research = await deepResearchCandidate(PERPLEXITY_API_KEY!, candidate, job);
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

      if (LOVABLE_API_KEY) {
        const generated = await generatePersonalizedHook(
          LOVABLE_API_KEY,
          candidate,
          job,
          hookPattern,
          researchSummary
        );
        hook = generated.hook;
        icebreaker = generated.icebreaker;
        talking_points = generated.talking_points;
      } else {
        // Basic fallback without AI
        hook = `Your ${candidate.specialty || 'medical'} background makes you a strong fit for our ${job.specialty} opportunity at ${job.facility_name}. $${job.bill_rate}/hour, ${job.city}, ${job.state}.`;
        icebreaker = `Hi Dr. ${candidate.last_name},`;
        talking_points = ['Competitive compensation', 'Excellent facility', 'Flexible scheduling'];
      }

      // Determine confidence based on research quality
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (researchDetails?.fellowship || researchDetails?.employer) {
        confidence = 'high';
      } else if (researchSummary && researchSummary.length > 200) {
        confidence = 'medium';
      } else if (candidate.company_name || candidate.board_certifications?.length) {
        confidence = 'medium';
      }

      results.push({
        candidate_id: candidate.id,
        candidate_name: `Dr. ${candidate.first_name} ${candidate.last_name}`,
        personalization_hook: hook,
        hook_type: hookPattern.type,
        confidence,
        research_sources: researchSources,
        talking_points,
        icebreaker,
        research_summary: useDeepResearch ? researchSummary : undefined
      });

      // Store in candidate_job_matches
      try {
        await supabase.rpc('upsert_candidate_job_match', {
          p_candidate_id: candidate.id,
          p_job_id: job_id,
          p_icebreaker: icebreaker,
          p_talking_points: talking_points
        });
      } catch (e) {
        console.error('Failed to upsert match:', e);
      }
    }

    console.log(`Generated ${results.length} personalization hooks`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        deep_research_used: useDeepResearch,
        total_candidates: results.length,
        high_confidence: results.filter(r => r.confidence === 'high').length,
        medium_confidence: results.filter(r => r.confidence === 'medium').length,
        low_confidence: results.filter(r => r.confidence === 'low').length
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
