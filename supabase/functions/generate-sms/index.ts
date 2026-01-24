import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  candidate_id: string;
  job_id: string;
  campaign_id?: string;
  template_style?: 'ca_license' | 'no_call' | 'compensation' | 'location' | 'board_eligible' | 'non_trauma';
  personalization_hook?: string;
  custom_context?: string;
  playbook_content?: string;
}

interface CandidateData {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  city?: string;
  licenses: string[];
  company_name?: string;
}

interface JobData {
  id: string;
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  specialty: string;
  bill_rate?: number;
  pay_rate?: number;
}

// Clinical Consultant SMS Persona
const SMS_PERSONA = `You generate candidate SMS that sounds like a clinical consultant who understands medicine—NOT a recruiter running a sales script.

SMS RULES - HARD LIMIT: 300 characters

REQUIRED ELEMENTS:
1. "Dr. [Last Name]" - professional address
2. "Locums" - they must know it's contract
3. Rate - EXACT from playbook (never calculate)
4. Location - city/metro + state
5. One clinical detail - case mix, call status, OR procedures
6. One personalization hook - their license, training, or setting
7. Soft CTA - "15 min to discuss fit?" / "Quick call on scope?"

FORMULA:
Dr. [Name] - [Locums] [Specialty] at [Location]: $[rate]/hr, [clinical detail]. [Personalization hook]. [Soft CTA]?

NEVER DO:
- Generic messages with no clinical detail
- Wrong or invented rates
- Missing "locums" signal
- Emojis or multiple exclamation points
- "I came across your profile" openers
- Exceed 300 characters`;

// Extract playbook rates - DYNAMIC extraction, NO hardcoded defaults
// Enhanced patterns to match Notion markdown format
function extractPlaybookRates(playbookContent: string): {
  hourly: string | null;
  daily: string | null;
  weekly: string | null;
  annual: string | null;
  extracted: boolean;
} {
  if (!playbookContent) {
    console.warn("PLAYBOOK: No playbook content provided");
    return { hourly: null, daily: null, weekly: null, annual: null, extracted: false };
  }

  console.log("PLAYBOOK CONTENT LENGTH:", playbookContent.length);
  console.log("PLAYBOOK SAMPLE (first 1000 chars):", playbookContent.substring(0, 1000));

  // Multiple patterns for each rate type - ordered by specificity
  // Notion markdown uses **Bold** format
  const hourlyPatterns = [
    // Notion markdown patterns: **Hourly Rate:** $500/hour
    /\*\*Hourly Rate:\*\*\s*\$(\d{2,4})(?:\/hour)?/i,
    /\*\*Hourly:\*\*\s*\$(\d{2,4})/i,
    // Plain text patterns
    /Hourly Rate:\s*\$(\d{2,4})/i,
    /Hourly:\s*\$(\d{2,4})/i,
    // Inline patterns: $500/hour, $500/hr, $500 per hour
    /\$(\d{2,4})\/hour/i,
    /\$(\d{2,4})\/hr/i,
    /\$(\d{2,4})\s+per\s+hour/i,
    // Generic fallback
    /pay\s*rate[:\s]*\$?(\d{2,4})/i,
  ];
  
  const dailyPatterns = [
    /\*\*Daily Earnings:\*\*\s*\$([\d,]+)/i,
    /\*\*Daily:\*\*\s*\$([\d,]+)/i,
    /Daily Earnings:\s*\$([\d,]+)/i,
    /Daily Rate:\s*\$([\d,]+)/i,
    /\$([\d,]+)\/day/i,
    /\$([\d,]+)\s+per\s+day/i,
  ];
  
  const weeklyPatterns = [
    /\*\*Weekly Earnings:\*\*\s*\$([\d,]+)/i,
    /\*\*Weekly:\*\*\s*\$([\d,]+)/i,
    /Weekly Earnings:\s*\$([\d,]+)/i,
    /Weekly Rate:\s*\$([\d,]+)/i,
    /\$([\d,]+)\/week/i,
    /\$([\d,]+)\s+per\s+week/i,
  ];
  
  const annualPatterns = [
    /\*\*Annual Potential:\*\*\s*\$([\d,]+)/i,
    /\*\*Annual:\*\*\s*\$([\d,]+)/i,
    /Annual Potential:\s*\$([\d,]+)/i,
    /Annual Earnings:\s*\$([\d,]+)/i,
    /\$([\d,]+(?:,\d{3})*)\s+(?:annual|annually|per\s+year)/i,
  ];

  const findMatch = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = playbookContent.match(pattern);
      if (match) {
        console.log(`RATE PATTERN MATCHED: ${pattern} -> ${match[1]}`);
        return match[1].replace(/,/g, '');
      }
    }
    return null;
  };

  const hourlyRaw = findMatch(hourlyPatterns);
  const dailyRaw = findMatch(dailyPatterns);
  const weeklyRaw = findMatch(weeklyPatterns);
  const annualRaw = findMatch(annualPatterns);

  const formatRate = (raw: string | null): string | null => {
    if (!raw) return null;
    const num = parseInt(raw, 10);
    if (isNaN(num)) return null;
    return `$${num.toLocaleString('en-US')}`;
  };

  const result = {
    hourly: formatRate(hourlyRaw),
    daily: formatRate(dailyRaw),
    weekly: formatRate(weeklyRaw),
    annual: formatRate(annualRaw),
    extracted: hourlyRaw !== null,
  };

  console.log("=== PLAYBOOK RATES EXTRACTED ===");
  console.log("Hourly:", result.hourly || "NOT FOUND");
  console.log("Daily:", result.daily || "NOT FOUND");
  console.log("Weekly:", result.weekly || "NOT FOUND");
  console.log("Annual:", result.annual || "NOT FOUND");
  console.log("Extraction success:", result.extracted);
  
  return result;
}

// Extract clinical details - DYNAMIC extraction, NO hardcoded defaults
function extractClinicalDetails(playbookContent: string): {
  callStatus: string | null;
  schedule: string | null;
  facilityType: string | null;
  credentialingDays: string | null;
  procedures: string | null;
  rvus: string | null;
  extracted: boolean;
} {
  if (!playbookContent) {
    console.warn("PLAYBOOK: No playbook content provided for clinical details");
    return { callStatus: null, schedule: null, facilityType: null, credentialingDays: null, procedures: null, rvus: null, extracted: false };
  }

  // Call status extraction
  let callStatus: string | null = null;
  if (/no\s*call|zero\s*call|on-?call[:\s]*no/i.test(playbookContent)) {
    callStatus = "zero call";
  } else if (/1\s*:\s*(\d+)\s*call/i.test(playbookContent)) {
    const match = playbookContent.match(/1\s*:\s*(\d+)\s*call/i);
    callStatus = match ? `1:${match[1]} call` : null;
  } else if (/light\s*call/i.test(playbookContent)) {
    callStatus = "light call";
  }

  // Schedule extraction
  let schedule: string | null = null;
  const schedulePatterns = [
    /schedule[:\s]*([^\n]+)/i,
    /hours[:\s]*([^\n]+)/i,
    /(M-F\s*\d+[ap]?m?\s*-\s*\d+[ap]?m?)/i,
    /(Monday\s*-?\s*Friday[^\n]*)/i,
  ];
  for (const pattern of schedulePatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      schedule = match[1].trim().replace(/\*+/g, '');
      break;
    }
  }

  // Facility type extraction
  let facilityType: string | null = null;
  if (/non-?trauma|non trauma/i.test(playbookContent)) {
    facilityType = "non-trauma";
  } else if (/level\s*[iI1]\s*trauma/i.test(playbookContent)) {
    facilityType = "Level I trauma";
  } else if (/level\s*[iI]{2,}|level\s*2/i.test(playbookContent)) {
    facilityType = "Level II trauma";
  } else if (/community\s*hospital/i.test(playbookContent)) {
    facilityType = "community hospital";
  } else if (/academic/i.test(playbookContent)) {
    facilityType = "academic center";
  }

  // Credentialing days extraction
  let credentialingDays: string | null = null;
  const credPatterns = [
    /credentialing[:\s]*(?:~)?(\d+)\s*days?/i,
    /(\d+)[\s-]*day\s*credentialing/i,
    /timeline[:\s]*(\d+)\s*days?/i,
  ];
  for (const pattern of credPatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      credentialingDays = match[1];
      break;
    }
  }

  // Procedures extraction
  let procedures: string | null = null;
  const procPatterns = [
    /procedures?[:\s]*([^\n]+)/i,
    /scope[:\s]*([^\n]+)/i,
    /case\s*types?[:\s]*([^\n]+)/i,
  ];
  for (const pattern of procPatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      procedures = match[1].trim().replace(/\*+/g, '');
      break;
    }
  }

  // RVU extraction
  let rvus: string | null = null;
  const rvuMatch = playbookContent.match(/~?(\d+)\s*RVUs?(?:\s*\/\s*shift)?/i);
  if (rvuMatch) {
    rvus = `~${rvuMatch[1]} RVUs/shift`;
  }

  const result = {
    callStatus,
    schedule,
    facilityType,
    credentialingDays,
    procedures,
    rvus,
    extracted: callStatus !== null || schedule !== null,
  };

  console.log("PLAYBOOK CLINICAL EXTRACTED:", result);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body: SMSRequest = await req.json();
    const { candidate_id, job_id, campaign_id, template_style = 'ca_license', personalization_hook, custom_context, playbook_content } = body;

    // Determine playbook content source - prefer provided content, fall back to campaign cache
    let effectivePlaybookContent = playbook_content || '';
    
    if (!effectivePlaybookContent && campaign_id) {
      console.log("No playbook_content provided - checking campaign cache...");
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('playbook_data')
        .eq('id', campaign_id)
        .maybeSingle();
      
      if (campaign?.playbook_data) {
        const cached = campaign.playbook_data as { content?: string; extracted_rates?: { hourly?: string } };
        if (cached.content && cached.content.length > 500) {
          effectivePlaybookContent = cached.content;
          console.log("✅ Using cached playbook from campaign:", campaign_id);
          console.log("Cached content length:", cached.content.length);
          if (cached.extracted_rates?.hourly) {
            console.log("Cached hourly rate:", cached.extracted_rates.hourly);
          }
        }
      }
    }

    // Fetch candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, specialty, state, city, licenses, company_name')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      throw new Error(`Candidate not found: ${candidateError?.message}`);
    }

    // Fetch job data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_name, facility_name, city, state, specialty, bill_rate, pay_rate')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Extract rates from playbook (NEVER calculate)
    const rates = extractPlaybookRates(effectivePlaybookContent);
    const clinical = extractClinicalDetails(effectivePlaybookContent);

    // Log extracted data for validation
    console.log("PLAYBOOK EXTRACTION VALIDATION:", {
      source: "playbook_content provided: " + (!!playbook_content),
      rates,
      clinical
    });

    // Validate required rate data - fail if missing
    if (!rates.hourly) {
      throw new Error("RATE NOT FOUND IN PLAYBOOK - cannot generate SMS without verified hourly compensation. Please ensure playbook contains rate information.");
    }

    // Check for existing personalization
    let hook = personalization_hook;
    if (!hook) {
      const { data: personalization } = await supabase
        .from('candidate_personalization')
        .select('email_opener, hooks')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .single();
      
      if (personalization?.email_opener) {
        hook = personalization.email_opener;
      }
    }

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Use null coalescing for optional clinical data
    const callText = clinical.callStatus || "flexible schedule";
    const scheduleText = clinical.schedule || "weekday hours";
    const facilityText = clinical.facilityType || "hospital";
    const credDays = clinical.credentialingDays || "expedited";
    const dailyRate = rates.daily || "";
    const weeklyRate = rates.weekly || "";

    // Build system prompt with safe values
    const systemPrompt = `${SMS_PERSONA}

PLAYBOOK DATA (USE EXACTLY):
- Rate: ${rates.hourly}/hr
${dailyRate ? `- Daily: ${dailyRate}` : ''}
${weeklyRate ? `- Weekly: ${weeklyRate}` : ''}
- Call: ${callText}
- Schedule: ${scheduleText}
- Facility: ${facilityText}
${credDays ? `- Credentialing: ${credDays} days` : ''}

CANDIDATE:
- Name: Dr. ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Location: ${candidate.city || ''}, ${candidate.state}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (has ${job.state})` : ''}

JOB:
- Facility: ${job.facility_name}
- Location: ${job.city}, ${job.state}
- Specialty: ${job.specialty}

${hook ? `PERSONALIZATION HOOK: ${hook}` : ''}
${custom_context ? `CONTEXT: ${custom_context}` : ''}`;

    // Template-based SMS generation (clinical consultant style)
    const generateFallbackSMS = () => {
      const location = `${job.city}`;
      const licenseHook = hasJobStateLicense 
        ? `Your ${job.state} license = ${credDays}-day start.`
        : `${licenseCount} licenses = flexibility.`;
      
      const templates = {
        ca_license: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${job.facility_name} (${location}): ${rates.hourly}/hr, ${callText}. ${licenseHook} 15 min to discuss fit?`, 
            style: 'license_priority' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr ${candidate.specialty} locums, ${facilityText} case mix. ${job.city}, ${job.state}. ${licenseHook} Quick call on scope?`, 
            style: 'clinical_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${job.facility_name}: ${rates.hourly}/hr, ${scheduleText}, ${callText}. ${licenseHook} Worth 15 min?`, 
            style: 'schedule_focus' 
          }
        ],
        no_call: [
          { 
            sms: `Dr. ${candidate.last_name} - ${candidate.specialty} locums with ZERO call. ${rates.hourly}/hr at ${job.facility_name}, ${location}. ${scheduleText}. ${licenseHook} 15 min?`, 
            style: 'no_call_emphasis' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - If call is burning you out: ${job.facility_name} locums, ${rates.hourly}/hr, zero call. ${facilityText}, ${location}. Worth discussing?`, 
            style: 'burnout_relief' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${rates.hourly}/hr, NO CALL. ${job.city} (${facilityText}). ${scheduleText}. ${licenseHook} Quick call?`, 
            style: 'direct' 
          }
        ],
        compensation: [
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr locums ${candidate.specialty} at ${job.facility_name}, ${location}. ${dailyRate ? `${dailyRate}/day, ` : ''}${callText}. ${licenseHook} 15 min to discuss?`, 
            style: 'rate_focused' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${rates.hourly}/hr${weeklyRate ? ` (${weeklyRate}/week)` : ''}. ${job.city}, ${callText}, ${facilityText}. ${licenseHook} Worth a call?`, 
            style: 'weekly_rate' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr ${candidate.specialty} locums. ${job.facility_name}, ${callText}. Routine case mix, sustainable pace. 15 min on clinical fit?`, 
            style: 'sustainable' 
          }
        ],
        non_trauma: [
          { 
            sms: `Dr. ${candidate.last_name} - ${facilityText} ${candidate.specialty} locums: ${rates.hourly}/hr, ${callText}. ${job.facility_name}, ${location}. Sustainable pace. ${licenseHook} 15 min?`, 
            style: 'non_trauma_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${facilityText}: ${rates.hourly}/hr, routine case mix. ${job.city}, ${callText}. Quick call on scope?`, 
            style: 'routine_case' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - No trauma chaos: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. ${callText}, ${scheduleText}. ${licenseHook} 15 min?`, 
            style: 'anti_trauma' 
          }
        ],
        location: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} in ${job.city}: ${rates.hourly}/hr, ${callText}. ${job.facility_name}, ${facilityText}. ${licenseHook} 15 min?`, 
            style: 'location_first' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${job.facility_name} (${location}): ${rates.hourly}/hr ${candidate.specialty} locums, ${callText}. ${licenseHook} Quick call on clinical fit?`, 
            style: 'facility_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${location} ${candidate.specialty} locums: ${rates.hourly}/hr at ${job.facility_name}. ${callText}, ${scheduleText}. Worth 15 min to discuss?`, 
            style: 'metro_focus' 
          }
        ],
        board_eligible: [
          { 
            sms: `Dr. ${candidate.last_name} - Board Eligible accepted: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. ${callText}, ${location}. Start earning now. 15 min?`, 
            style: 'be_accepted' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Recent fellowship? ${job.facility_name} takes Board Eligible: ${rates.hourly}/hr, ${callText}. ${location}. Earn while prepping boards. Quick call?`, 
            style: 'new_grad' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Don't wait for boards: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. BE within 5 years OK. ${callText}. 15 min?`, 
            style: 'immediate_start' 
          }
        ]
      };
      
      return templates[template_style] || templates.ca_license;
    };

    let smsOptions = [];
    let usedFallback = false;

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate 3 SMS options for Dr. ${candidate.last_name}. 

CRITICAL REQUIREMENTS:
1. Each SMS MUST be under 300 characters
2. Use EXACT rate: ${rates.hourly}/hr (never calculate or round)
3. Include "locums" - they must know it's contract
4. Include one clinical detail (case mix, call status, or procedures)
5. Include one personalization hook (license advantage, training, or setting)
6. End with soft CTA: "15 min to discuss fit?" or "Quick call on scope?"
7. NO emojis, NO exclamation points
8. Sound like a clinical consultant, not a recruiter

Return as JSON array: [{"sms": "...", "style": "one-word-description"}]` }
          ],
          temperature: 0.8,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.warn("AI API unavailable, using fallback templates:", errorText);
        smsOptions = generateFallbackSMS();
        usedFallback = true;
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            smsOptions = JSON.parse(jsonMatch[0]);
          } else {
            smsOptions = generateFallbackSMS();
            usedFallback = true;
          }
        } catch (parseError) {
          console.warn("Failed to parse AI response, using fallback:", content);
          smsOptions = generateFallbackSMS();
          usedFallback = true;
        }
      }
    } catch (fetchError) {
      console.warn("AI fetch failed, using fallback templates:", fetchError);
      smsOptions = generateFallbackSMS();
      usedFallback = true;
    }

    // Ensure all messages are under 300 chars and add char count
    smsOptions = smsOptions.map((opt: { sms: string; style: string }) => ({
      ...opt,
      sms: opt.sms.length > 300 ? opt.sms.substring(0, 297) + '...' : opt.sms,
      char_count: Math.min(opt.sms.length, 300)
    }));

    return new Response(
      JSON.stringify({
        success: true,
        candidate: {
          id: candidate.id,
          name: `Dr. ${candidate.last_name}`,
          specialty: candidate.specialty,
        },
        job: {
          id: job.id,
          name: job.job_name,
          location: `${job.city}, ${job.state}`,
        },
        sms_options: smsOptions,
        template_style,
        rates_used: rates,
        personalization_used: !!hook,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("SMS generation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
