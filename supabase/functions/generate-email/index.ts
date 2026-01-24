import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  candidate_id: string;
  job_id: string;
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

// Extract playbook rates from content - USE EXACT VALUES, NEVER CALCULATE
function extractPlaybookRates(playbookContent: string): {
  hourly: string;
  daily: string;
  weekly: string;
  annual: string;
} {
  const defaults = {
    hourly: "$500",
    daily: "$4,500",
    weekly: "$22,500",
    annual: "$1,170,000"
  };

  if (!playbookContent) return defaults;

  // Extract exact rates from playbook - look for the CORRECT rates section
  const hourlyMatch = playbookContent.match(/\*\*Hourly\*\*[:\s]*\*?\*?\$?([\d,]+)/i) ||
                      playbookContent.match(/Hourly[:\s]*\$?([\d,]+)(?:\/hour)?/i);
  const dailyMatch = playbookContent.match(/\*\*Daily\*\*[:\s]*\*?\*?\$?([\d,]+)/i) ||
                     playbookContent.match(/Daily[:\s]*\$?([\d,]+)/i);
  const weeklyMatch = playbookContent.match(/\*\*Weekly\*\*[:\s]*\*?\*?\$?([\d,]+)/i) ||
                      playbookContent.match(/Weekly[:\s]*\$?([\d,]+)/i);
  const annualMatch = playbookContent.match(/\*\*Annual\*\*[:\s]*\*?\*?\$?([\d,]+(?:,\d+)*)/i) ||
                      playbookContent.match(/Annual[:\s]*\$?([\d,]+(?:,\d+)*)/i);

  return {
    hourly: hourlyMatch ? `$${hourlyMatch[1].replace(/,/g, '')}` : defaults.hourly,
    daily: dailyMatch ? `$${dailyMatch[1]}` : defaults.daily,
    weekly: weeklyMatch ? `$${weeklyMatch[1]}` : defaults.weekly,
    annual: annualMatch ? `$${annualMatch[1]}` : defaults.annual
  };
}

// Extract clinical details from playbook
function extractClinicalDetails(playbookContent: string): {
  procedures: string;
  callStatus: string;
  schedule: string;
  rvus: string;
  facilityType: string;
  credentialingDays: string;
  techStack: string;
} {
  const defaults = {
    procedures: "CT/US biopsies, drains, ports, PICC lines, nephrostomy tubes, abscess drainage",
    callStatus: "Zero call",
    schedule: "M-F 8am-5pm",
    rvus: "~50 RVUs/shift",
    facilityType: "Non-trauma center",
    credentialingDays: "40 days",
    techStack: "PowerScribe 4.0"
  };

  if (!playbookContent) return defaults;

  // Extract call status
  let callStatus = defaults.callStatus;
  if (playbookContent.toLowerCase().includes("no call") || 
      playbookContent.toLowerCase().includes("zero call") ||
      playbookContent.toLowerCase().includes("on-call:** no")) {
    callStatus = "Zero call";
  }

  // Extract RVUs
  const rvuMatch = playbookContent.match(/(\d+)\s*RVU/i);
  const rvus = rvuMatch ? `~${rvuMatch[1]} RVUs/shift` : defaults.rvus;

  // Extract credentialing
  const credMatch = playbookContent.match(/(\d+)[\s-]*day(?:s)?\s*(?:credentialing)?/i);
  const credentialingDays = credMatch ? `${credMatch[1]} days` : defaults.credentialingDays;

  return {
    ...defaults,
    callStatus,
    rvus,
    credentialingDays
  };
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
    const { candidate_id, job_id, personalization_hook, custom_context, playbook_content } = body;

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
    const rates = extractPlaybookRates(playbook_content || '');
    const clinical = extractClinicalDetails(playbook_content || '');

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

    // Build personalization hooks
    const personalizationHooks: string[] = [];
    if (hasJobStateLicense) {
      personalizationHooks.push(`Your ${job.state} license = ${clinical.credentialingDays} credentialing vs. 6+ months for others`);
    }
    if (candidate.company_name) {
      personalizationHooks.push(`Your work at ${candidate.company_name} suggests you understand sustainable practice`);
    }
    if (licenseCount >= 10) {
      personalizationHooks.push(`Your ${licenseCount} state licenses indicate flexibility for multi-state work`);
    }

    // Build the clinical consultant prompt
    const systemPrompt = `${CLINICAL_CONSULTANT_PERSONA}

PLAYBOOK RATES (USE EXACTLY - NEVER CALCULATE OR MODIFY):
- Hourly: ${rates.hourly}/hour
- Daily: ${rates.daily}
- Weekly: ${rates.weekly}
- Annual: ${rates.annual}

CLINICAL DETAILS:
- Procedures: ${clinical.procedures}
- Call: ${clinical.callStatus}
- Schedule: ${clinical.schedule}
- Productivity: ${clinical.rvus} (sustainable pace)
- Facility: ${clinical.facilityType}
- Credentialing: ${clinical.credentialingDays}
- Tech: ${clinical.techStack}

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
${rates.hourly} | ${rates.daily} | ${rates.weekly}
[OT policy if relevant]
[Annual potential: ${rates.annual}]

Credentialing: [Their license advantage + timeline + temps if available]

Why I'm reaching out to you specifically: [2-3 sentences connecting THEIR background to THIS role]

[CLOSER: 15-minute offer + permission to decline + no pressure]

Best regards,
[Recruiter Name]
Locums One`;

    // Fallback email generator - clinical consultant style
    const generateFallbackEmail = () => {
      const subject = `${job.city} ${candidate.specialty} locums - ${clinical.callStatus.toLowerCase()}, ${rates.hourly}/hr`;
      
      const licenseAdvantage = hasJobStateLicense 
        ? `Your ${job.state} license means ${clinical.credentialingDays} credentialing vs. 6+ months for out-of-state physicians.`
        : `With your ${licenseCount} state licenses, obtaining ${job.state} licensure positions you well for this opportunity.`;

      const body = `Dr. ${candidate.last_name},

${candidate.company_name 
  ? `Your work at ${candidate.company_name}, combined with your ${candidate.specialty} background, aligns directly with what ${job.facility_name} needs for their locums coverage.`
  : `Your ${candidate.specialty} background and ${job.state} presence make you a strong fit for ${job.facility_name}'s locums need.`}

Clinical Scope:
${clinical.facilityType} hospital in ${job.city}, ${job.state}
Case types: ${clinical.procedures}
Volume: ${clinical.rvus} (sustainable for experienced ${candidate.specialty})
Tech: ${clinical.techStack}
Not a trauma center - routine case mix

Schedule & Call:
${clinical.schedule}
${clinical.callStatus} - no evenings, no weekends, no pager
Long-term locums (ongoing coverage need)

Compensation:
${rates.hourly} hourly | ${rates.daily} daily | ${rates.weekly} weekly
Annual potential: ${rates.annual}
OT available after 9 hours daily

Credentialing: ${licenseAdvantage} ${clinical.credentialingDays} timeline with temps available for clean files.

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
