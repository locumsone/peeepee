import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateToResearch {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  state?: string;
  npi?: string;
  licenses?: string[];
}

interface JobContext {
  id: string;
  specialty: string;
  state: string;
  requirements?: string[];
  raw_job_text?: string;
}

interface ResearchResult {
  id: string;
  verified_npi: boolean;
  npi_data?: {
    name: string;
    credential: string;
    specialty: string;
    state: string;
    licenses: string[];
    address_city?: string;
    address_state?: string;
  };
  web_research?: {
    publications: string[];
    affiliations: string[];
    education: string[];
    notable_info: string[];
  };
  match_analysis: {
    score: number;
    grade: string;
    reasons: string[];
    concerns: string[];
    has_imlc: boolean;
    license_match: boolean;
    icebreaker: string;
    talking_points: string[];
  };
  researched_at: string;
}

// Check NPPES NPI Registry
async function verifyNPI(npi: string, firstName: string, lastName: string): Promise<any> {
  try {
    const params = new URLSearchParams();
    if (npi) {
      params.set('number', npi);
    } else {
      params.set('first_name', firstName);
      params.set('last_name', lastName);
    }
    params.set('version', '2.1');
    
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;
    
    const result = data.results[0];
    const taxonomies = result.taxonomies || [];
    const primaryTaxonomy = taxonomies.find((t: any) => t.primary) || taxonomies[0];
    
    const addresses = result.addresses || [];
    const practiceAddress = addresses.find((a: any) => a.address_purpose === 'LOCATION') || addresses[0];
    
    // Extract all state licenses from taxonomy
    const licenses = taxonomies
      .filter((t: any) => t.state)
      .map((t: any) => t.state);
    
    return {
      npi: result.number,
      name: `${result.basic?.first_name || ''} ${result.basic?.last_name || ''}`.trim(),
      credential: result.basic?.credential || '',
      specialty: primaryTaxonomy?.desc || '',
      taxonomy_code: primaryTaxonomy?.code || '',
      state: primaryTaxonomy?.state || practiceAddress?.state || '',
      licenses: [...new Set(licenses)],
      address_city: practiceAddress?.city || '',
      address_state: practiceAddress?.state || '',
    };
  } catch (error) {
    console.error('NPI verification error:', error);
    return null;
  }
}

// Infer IMLC status based on license count and pattern
function inferIMLCStatus(licenses: string[], jobState: string): { has_imlc: boolean; reason: string } {
  if (!licenses || licenses.length === 0) {
    return { has_imlc: false, reason: 'No license data' };
  }
  
  // IMLC member states as of 2024
  const imlcStates = [
    'AL', 'AZ', 'AR', 'CO', 'DE', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NC', 'ND',
    'OH', 'OK', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  
  const candidateLicenses = licenses.map(l => l.toUpperCase());
  const hasJobState = candidateLicenses.includes(jobState.toUpperCase());
  
  // If they have 10+ licenses AND many are IMLC states, they likely have IMLC
  if (licenses.length >= 10) {
    const imlcCount = candidateLicenses.filter(l => imlcStates.includes(l)).length;
    const imlcRatio = imlcCount / licenses.length;
    
    if (imlcRatio >= 0.7) {
      // If job state is IMLC state and they have 10+ IMLC licenses, they likely can practice
      if (imlcStates.includes(jobState.toUpperCase())) {
        return { 
          has_imlc: true, 
          reason: `${licenses.length} licenses with ${imlcCount} IMLC states - likely has IMLC compact license`
        };
      }
    }
  }
  
  // If they have 10+ licenses but don't have the job state, check if job state is IMLC
  if (licenses.length >= 10 && !hasJobState && imlcStates.includes(jobState.toUpperCase())) {
    return {
      has_imlc: true,
      reason: `${licenses.length} multi-state licenses and ${jobState} is an IMLC state - can likely practice via IMLC`
    };
  }
  
  return { has_imlc: false, reason: hasJobState ? `Licensed in ${jobState}` : 'No IMLC detected' };
}

// Use AI to research candidate and match
async function aiResearchAndMatch(
  apiKey: string,
  candidate: CandidateToResearch,
  job: JobContext,
  npiData: any
): Promise<ResearchResult['match_analysis']> {
  const imlcResult = inferIMLCStatus(
    npiData?.licenses || candidate.licenses || [],
    job.state
  );
  
  const systemPrompt = `You are an expert healthcare recruiter researching physician candidates for locum tenens positions.

Analyze the candidate's credentials against the job requirements and provide a rigorous, accurate match assessment.

CRITICAL SCORING RULES:
1. License Match: If candidate does NOT have the required state license AND cannot practice via IMLC, score BELOW 70
2. Specialty Match: If specialty is not an exact match or closely related subspecialty, score BELOW 80
3. Experience: Consider years of experience, board certification, procedural competencies
4. Contact Quality: Candidates with verified personal contact info are more actionable

IMLC Status: ${imlcResult.has_imlc ? `YES - ${imlcResult.reason}` : `NO - ${imlcResult.reason}`}

Grade scale (be rigorous!):
- A+ (95-100): Perfect match - has state license, exact specialty, verified contact
- A (90-94): Excellent - direct license or IMLC, matching specialty
- A- (85-89): Strong - can practice in state, relevant specialty
- B+ (80-84): Good - minor gaps (e.g., needs quick licensure)
- B (75-79): Acceptable - some concerns but workable
- B- (70-74): Marginal - significant gaps
- C (60-69): Weak - major mismatches
- D (<60): Poor fit`;

  const candidateInfo = `
CANDIDATE:
Name: ${candidate.first_name} ${candidate.last_name}
NPI: ${npiData?.npi || candidate.npi || 'Unknown'}
Specialty: ${npiData?.specialty || candidate.specialty || 'Unknown'}
Credential: ${npiData?.credential || 'Unknown'}
Location: ${npiData?.address_city || ''}, ${npiData?.address_state || candidate.state || 'Unknown'}
Licenses: ${(npiData?.licenses || candidate.licenses || []).join(', ') || 'Unknown'}
License Count: ${(npiData?.licenses || candidate.licenses || []).length}
`;

  const jobInfo = job.raw_job_text || `
JOB:
Specialty: ${job.specialty}
State: ${job.state}
Requirements: ${job.requirements?.join(', ') || 'Not specified'}
`;

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
          { role: "user", content: `${candidateInfo}\n\n${jobInfo}\n\nProvide a rigorous match assessment.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "candidate_match_assessment",
            description: "Provide rigorous match assessment for candidate",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "0-100 match score" },
                grade: { type: "string", enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"] },
                reasons: { type: "array", items: { type: "string" }, description: "Why they match" },
                concerns: { type: "array", items: { type: "string" }, description: "Red flags or gaps" },
                icebreaker: { type: "string", description: "Personalized outreach opener" },
                talking_points: { type: "array", items: { type: "string" }, description: "Key selling points" }
              },
              required: ["score", "grade", "reasons", "concerns", "icebreaker", "talking_points"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "candidate_match_assessment" } }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      const hasLicense = (npiData?.licenses || candidate.licenses || [])
        .some((l: string) => l.toUpperCase() === job.state.toUpperCase());
      
      return {
        score: parsed.score,
        grade: parsed.grade,
        reasons: parsed.reasons || [],
        concerns: parsed.concerns || [],
        has_imlc: imlcResult.has_imlc,
        license_match: hasLicense || imlcResult.has_imlc,
        icebreaker: parsed.icebreaker || '',
        talking_points: parsed.talking_points || [],
      };
    }
  } catch (error) {
    console.error('AI research error:', error);
  }
  
  // Fallback
  const hasLicense = (candidate.licenses || []).some(l => l.toUpperCase() === job.state.toUpperCase());
  return {
    score: hasLicense ? 75 : (imlcResult.has_imlc ? 70 : 50),
    grade: hasLicense ? 'B' : (imlcResult.has_imlc ? 'B-' : 'C'),
    reasons: hasLicense ? [`Licensed in ${job.state}`] : (imlcResult.has_imlc ? [imlcResult.reason] : ['Basic match']),
    concerns: hasLicense ? [] : ['License verification needed'],
    has_imlc: imlcResult.has_imlc,
    license_match: hasLicense || imlcResult.has_imlc,
    icebreaker: `Hi ${candidate.first_name}, I found an opportunity that matches your background.`,
    talking_points: ['Competitive compensation', 'Flexible scheduling'],
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
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { candidates, job, skip_research = false } = await req.json();
    
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      throw new Error('candidates array is required');
    }
    if (!job || !job.id) {
      throw new Error('job context is required');
    }

    console.log(`Researching ${candidates.length} candidates for job ${job.id}`);
    
    const results: ResearchResult[] = [];
    
    for (const candidate of candidates) {
      console.log(`Researching: ${candidate.first_name} ${candidate.last_name}`);
      
      // Step 1: Verify NPI (unless skipping research)
      let npiData = null;
      if (!skip_research) {
        npiData = await verifyNPI(
          candidate.npi || '',
          candidate.first_name,
          candidate.last_name
        );
        if (npiData) {
          console.log(`NPI verified: ${npiData.npi} - ${npiData.specialty}`);
        }
      }
      
      // Step 2: AI analysis with research context
      let matchAnalysis;
      if (LOVABLE_API_KEY && !skip_research) {
        matchAnalysis = await aiResearchAndMatch(
          LOVABLE_API_KEY,
          candidate,
          job,
          npiData
        );
      } else {
        // Quick scoring without research
        const imlcResult = inferIMLCStatus(candidate.licenses || [], job.state);
        const hasLicense = (candidate.licenses || []).some(
          (l: string) => l.toUpperCase() === job.state.toUpperCase()
        );
        
        matchAnalysis = {
          score: hasLicense ? 80 : (imlcResult.has_imlc ? 75 : 60),
          grade: hasLicense ? 'B+' : (imlcResult.has_imlc ? 'B' : 'C'),
          reasons: hasLicense ? [`Licensed in ${job.state}`] : (imlcResult.has_imlc ? [imlcResult.reason] : []),
          concerns: [],
          has_imlc: imlcResult.has_imlc,
          license_match: hasLicense || imlcResult.has_imlc,
          icebreaker: `Hi ${candidate.first_name}`,
          talking_points: [],
        };
      }
      
      results.push({
        id: candidate.id,
        verified_npi: !!npiData,
        npi_data: npiData || undefined,
        match_analysis: matchAnalysis,
        researched_at: new Date().toISOString(),
      });
    }
    
    return new Response(
      JSON.stringify({ 
        results,
        researched_count: results.length,
        skip_research,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Candidate Research error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
