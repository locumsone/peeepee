import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  candidate_id: string;
  job_id: string;
  campaign_id?: string;
  personalization_hook?: string;
  custom_context?: string;
  playbook_content?: string;
}

// Clinical Consultant Persona - NOT a recruiter
const CLINICAL_CONSULTANT_PERSONA = `You are a clinical consultant who understands medicine—NOT a recruiter running a sales script.

YOU UNDERSTAND:
- Procedural scope and what procedures actually entail
- RVU expectations and sustainable vs. sweatshop pace
- Call burden and why "no call" is clinically significant
- Credentialing timelines and state licensure implications
- Burnout vectors in different practice settings

LANGUAGE TRANSLATION - NEVER use recruiter speak:
WRONG (Recruiter)          → RIGHT (Clinical Consultant)
"Exciting procedures"      → "CT/US biopsies, ports, nephrostomy, drains"
"Elite compensation"       → "$500/hour" (exact rate)
"Great work-life balance"  → "Zero call. M-F 8-5. Done at 5."
"Amazing opportunity"      → "Long-term locums, non-trauma case mix"
"Fast-paced environment"   → "~50 RVUs/shift (sustainable pace)"
"Competitive salary"       → State the actual rate or don't mention
"We have an opening"       → "I have a locums opportunity that fits your background"
"I'd love to connect!"     → "Worth 15 minutes to discuss clinical fit?"

TONE RULES:
- No exclamation points in body text
- Contractions okay (you're, it's, don't)
- Short paragraphs, scannable
- End with low-pressure CTA that gives them an out
- Add "If it's not the right fit, I'll tell you directly"

FORBIDDEN:
- Generic "I came across your profile" openers
- Emojis of any kind
- Words: "elite", "amazing", "exciting", "fantastic", "incredible"
- Headers with emojis or "Intelligence Brief"
- Bill rate (only show pay rate to candidates)`;

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
  techStack: string | null;
  extracted: boolean;
} {
  if (!playbookContent) {
    console.warn("PLAYBOOK: No playbook content provided for clinical details");
    return { callStatus: null, schedule: null, facilityType: null, credentialingDays: null, procedures: null, rvus: null, techStack: null, extracted: false };
  }

  // Call status
  let callStatus: string | null = null;
  if (/no\s*call|zero\s*call|on-?call[:\s]*no/i.test(playbookContent)) {
    callStatus = "Zero call";
  } else if (/1\s*:\s*(\d+)\s*call/i.test(playbookContent)) {
    const match = playbookContent.match(/1\s*:\s*(\d+)\s*call/i);
    callStatus = match ? `1:${match[1]} call` : null;
  } else if (/light\s*call/i.test(playbookContent)) {
    callStatus = "Light call";
  }

  // Schedule
  let schedule: string | null = null;
  const schedulePatterns = [
    /schedule[:\s]*([^\n]+)/i,
    /hours[:\s]*([^\n]+)/i,
    /(M-F\s*\d+[ap]?m?\s*-\s*\d+[ap]?m?)/i,
  ];
  for (const pattern of schedulePatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      schedule = match[1].trim().replace(/\*+/g, '');
      break;
    }
  }

  // Facility type
  let facilityType: string | null = null;
  if (/non-?trauma|non trauma/i.test(playbookContent)) {
    facilityType = "Non-trauma center";
  } else if (/level\s*[iI1]\s*trauma/i.test(playbookContent)) {
    facilityType = "Level I trauma center";
  } else if (/level\s*[iI]{2,}|level\s*2/i.test(playbookContent)) {
    facilityType = "Level II trauma center";
  } else if (/community\s*hospital/i.test(playbookContent)) {
    facilityType = "Community hospital";
  } else if (/academic/i.test(playbookContent)) {
    facilityType = "Academic medical center";
  }

  // Credentialing days
  let credentialingDays: string | null = null;
  const credPatterns = [
    /credentialing[:\s]*(?:~)?(\d+)\s*days?/i,
    /(\d+)[\s-]*day\s*credentialing/i,
    /timeline[:\s]*(\d+)\s*days?/i,
  ];
  for (const pattern of credPatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      credentialingDays = `${match[1]} days`;
      break;
    }
  }

  // Procedures
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

  // RVUs
  let rvus: string | null = null;
  const rvuMatch = playbookContent.match(/~?(\d+)\s*RVUs?(?:\s*\/\s*shift)?/i);
  if (rvuMatch) {
    rvus = `~${rvuMatch[1]} RVUs/shift`;
  }

  // Tech stack
  let techStack: string | null = null;
  const techPatterns = [
    /tech[:\s]*([^\n]+)/i,
    /emr[:\s]*([^\n]+)/i,
    /pacs[:\s]*([^\n]+)/i,
    /powerscribe[^\n]*/i,
  ];
  for (const pattern of techPatterns) {
    const match = playbookContent.match(pattern);
    if (match) {
      techStack = match[0].trim().replace(/\*+/g, '');
      break;
    }
  }

  const result = {
    callStatus,
    schedule,
    facilityType,
    credentialingDays,
    procedures,
    rvus,
    techStack,
    extracted: callStatus !== null || schedule !== null || procedures !== null,
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

    const body: EmailRequest = await req.json();
    const { candidate_id, job_id, campaign_id, personalization_hook, custom_context, playbook_content } = body;

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

    // Extract rates from playbook (NEVER calculate - use exact values)
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
      throw new Error("RATE NOT FOUND IN PLAYBOOK - cannot generate message without verified hourly compensation. Please ensure playbook contains rate information.");
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

    // Get job match data for talking points
    const { data: jobMatch } = await supabase
      .from('candidate_job_matches')
      .select('talking_points, icebreaker, match_reasons')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .single();

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Build personalization hooks - use null coalescing for optional clinical data
    const credDays = clinical.credentialingDays || "expedited";
    const personalizationHooks: string[] = [];
    if (hasJobStateLicense) {
      personalizationHooks.push(`Your ${job.state} license = ${credDays} credentialing vs. 6+ months for others`);
    }
    if (candidate.company_name) {
      personalizationHooks.push(`Your work at ${candidate.company_name} suggests you understand sustainable practice`);
    }
    if (licenseCount >= 10) {
      personalizationHooks.push(`Your ${licenseCount} state licenses indicate flexibility for multi-state work`);
    }

    // Use null coalescing for optional clinical data in system prompt
    const callText = clinical.callStatus || "flexible schedule";
    const scheduleText = clinical.schedule || "Standard hours";
    const facilityText = clinical.facilityType || "Hospital";
    const procText = clinical.procedures || `${candidate.specialty} procedures`;
    const rvuText = clinical.rvus || "sustainable volume";
    const techText = clinical.techStack || "Modern EMR";
    const dailyRate = rates.daily || "";
    const weeklyRate = rates.weekly || "";
    const annualRate = rates.annual || "";

    // Build compensation line for prompt
    let compLinePrompt = `${rates.hourly}`;
    if (dailyRate) compLinePrompt += ` | ${dailyRate}`;
    if (weeklyRate) compLinePrompt += ` | ${weeklyRate}`;

    // Build the clinical consultant prompt
    const systemPrompt = `${CLINICAL_CONSULTANT_PERSONA}

PLAYBOOK RATES (USE EXACTLY - NEVER CALCULATE OR MODIFY):
- Hourly: ${rates.hourly}/hour
${dailyRate ? `- Daily: ${dailyRate}` : ''}
${weeklyRate ? `- Weekly: ${weeklyRate}` : ''}
${annualRate ? `- Annual: ${annualRate}` : ''}

CLINICAL DETAILS:
- Procedures: ${procText}
- Call: ${callText}
- Schedule: ${scheduleText}
- Productivity: ${rvuText} (sustainable pace)
- Facility: ${facilityText}
- Credentialing: ${credDays}
- Tech: ${techText}

CANDIDATE DATA:
- Name: Dr. ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Location: ${candidate.city || ''}, ${candidate.state}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (includes ${job.state})` : ''}
- Current employer: ${candidate.company_name || 'Unknown'}

JOB DATA:
- Position: ${job.specialty} at ${job.facility_name}
- Location: ${job.city}, ${job.state}

PERSONALIZATION HOOKS TO USE (at least 2):
${personalizationHooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}
${hook ? `\nADDITIONAL CONTEXT: ${hook}` : ''}
${custom_context ? `\nCUSTOM CONTEXT: ${custom_context}` : ''}

EMAIL STRUCTURE TO FOLLOW:
Subject: [Location] [Specialty] locums - [clinical detail], [call status], ${rates.hourly}/hr

Dr. [Last Name],

[OPENER: 1-2 sentences connecting THEIR specific background to this outreach. Reference their training, current employer, or experience. Never generic.]

Clinical Scope:
[Setting/facility type]
Case types: [SPECIFIC procedures]
Volume: [RVUs] ([sustainability comment])
Tech: [EMR/PACS]
[What it's NOT - no trauma, no call, etc.]

Schedule & Call:
[Days/hours]
[Call status - be explicit: "Zero call" not "light call"]
[Contract duration]

Compensation:
${compLinePrompt}
[OT policy if relevant]
${annualRate ? `[Annual potential: ${annualRate}]` : ''}

Credentialing: [Their license advantage + timeline + temps if available]

Why I'm reaching out to you specifically: [2-3 sentences connecting THEIR background to THIS role]

[CLOSER: 15-minute offer + permission to decline + no pressure]

Best regards,
[Recruiter Name]
Locums One`;

    // Fallback email generator - clinical consultant style
    const generateFallbackEmail = () => {
      // Use null coalescing for optional clinical data
      const callText = clinical.callStatus || "flexible call";
      const scheduleText = clinical.schedule || "Standard hours";
      const facilityText = clinical.facilityType || "Hospital";
      const procText = clinical.procedures || `${candidate.specialty} procedures`;
      const rvuText = clinical.rvus || "sustainable volume";
      const techText = clinical.techStack || "Modern EMR";
      const dailyRate = rates.daily || "";
      const weeklyRate = rates.weekly || "";
      const annualRate = rates.annual || "";

      const subject = `${job.city} ${candidate.specialty} locums - ${callText.toLowerCase()}, ${rates.hourly}/hr`;
      
      const licenseAdvantage = hasJobStateLicense 
        ? `Your ${job.state} license means ${credDays} credentialing vs. 6+ months for out-of-state physicians.`
        : `With your ${licenseCount} state licenses, obtaining ${job.state} licensure positions you well for this opportunity.`;

      // Build compensation line dynamically based on what's available
      let compLine = `${rates.hourly} hourly`;
      if (dailyRate) compLine += ` | ${dailyRate} daily`;
      if (weeklyRate) compLine += ` | ${weeklyRate} weekly`;

      const body = `Dr. ${candidate.last_name},

${candidate.company_name 
  ? `Your work at ${candidate.company_name}, combined with your ${candidate.specialty} background, aligns directly with what ${job.facility_name} needs for their locums coverage.`
  : `Your ${candidate.specialty} background and ${job.state} presence make you a strong fit for ${job.facility_name}'s locums need.`}

Clinical Scope:
${facilityText} in ${job.city}, ${job.state}
Case types: ${procText}
Volume: ${rvuText} (sustainable for experienced ${candidate.specialty})
Tech: ${techText}

Schedule & Call:
${scheduleText}
${callText}
Long-term locums (ongoing coverage need)

Compensation:
${compLine}
${annualRate ? `Annual potential: ${annualRate}` : ''}

Credentialing: ${licenseAdvantage}

Why you specifically: Your ${candidate.specialty} expertise and ${hasJobStateLicense ? `active ${job.state} license` : `multi-state licensing`} mean you can start faster than most candidates while handling the procedural scope ${job.facility_name} requires.

If this fits what you're looking for, worth 15 minutes to walk through the clinical details. If it's not the right fit, I'll tell you directly - no pressure.

Best regards,
Locums One`;

      return { subject, body };
    };

    let emailResult = { subject: '', body: '' };
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
            { role: "user", content: `Generate a professional clinical consultant email for Dr. ${candidate.last_name}. 

CRITICAL REQUIREMENTS:
1. Use EXACT rates from playbook: ${rates.hourly}/hr, ${rates.daily}/day, ${rates.weekly}/week, ${rates.annual}/year
2. Include "locums" in subject and body
3. Reference at least 2 personalization hooks
4. No emojis, no exclamation points in body
5. Sound like a clinical consultant who understands medicine, not a recruiter
6. NEVER use "elite", "amazing", "exciting" or similar recruiter buzzwords

Return as JSON: {"subject": "...", "body": "..."}` }
          ],
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.warn("AI API unavailable, using fallback:", errorText);
        emailResult = generateFallbackEmail();
        usedFallback = true;
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
          if (jsonMatch) {
            emailResult = JSON.parse(jsonMatch[0]);
          } else {
            emailResult = generateFallbackEmail();
            usedFallback = true;
          }
        } catch (parseError) {
          console.warn("Failed to parse AI response, using fallback:", content);
          emailResult = generateFallbackEmail();
          usedFallback = true;
        }
      }
    } catch (fetchError) {
      console.warn("AI fetch failed, using fallback:", fetchError);
      emailResult = generateFallbackEmail();
      usedFallback = true;
    }

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
        email: emailResult,
        rates_used: rates,
        personalization_hooks: personalizationHooks,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Email generation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
