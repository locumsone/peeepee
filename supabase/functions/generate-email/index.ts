import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserSignature {
  full_name: string;
  first_name: string;
  title: string;
  company: string;
  phone?: string | null;
}

interface EmailRequest {
  candidate_id: string;
  job_id: string;
  campaign_id?: string;
  personalization_hook?: string;
  custom_context?: string;
  playbook_data?: StructuredPlaybookCache; // Allow passing structured playbook directly
  signature?: UserSignature; // User signature for email sign-off
}

// Structured Playbook Cache interface (matches the new format)
interface StructuredPlaybookCache {
  compensation: {
    hourly: string | null;
    daily: string | null;
    weekly: string | null;
    annual: string | null;
    salary_range: string | null;
  };
  position: {
    title: string | null;
    facility_name: string | null;
    facility_type: string | null;
    location_city: string | null;
    location_state: string | null;
    location_metro: string | null;
    contract_type: string | null;
  };
  clinical: {
    procedures: string | null;
    case_types: string | null;
    case_mix: string | null;
    volume: string | null;
    call_status: string | null;
    schedule_days: string | null;
    schedule_hours: string | null;
    duration: string | null;
    tech_stack: string | null;
  };
  credentialing: {
    required_license: string | null;
    days_to_credential: number | null;
    temps_available: boolean | null;
    requirements: string | null;
  };
  positioning: {
    selling_points: string | null;
    pain_points_solved: string | null;
    ideal_candidate: string | null;
    differentiators: string | null;
    messaging_tone: string | null;
    objection_responses: string | null;
    facility_context: string | null;
  };
  metadata: {
    notion_id: string | null;
    notion_url: string | null;
    title: string | null;
    synced_at: string | null;
    content_length: number | null;
  };
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

// Check if playbook data is structured format
function isStructuredCache(data: unknown): data is StructuredPlaybookCache {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return 'compensation' in d && 'position' in d && 'clinical' in d && 'positioning' in d;
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
    const { candidate_id, job_id, campaign_id, personalization_hook, custom_context, playbook_data, signature } = body;
    
    // Build signature block (use provided or default)
    const sigFullName = signature?.full_name || 'Locums One';
    const sigTitle = signature?.title || 'Clinical Consultant';
    const sigCompany = signature?.company || 'Locums One';
    const sigPhone = signature?.phone || null;
    
    let signatureBlock = `Best regards,\n${sigFullName}\n${sigTitle}\n${sigCompany}`;
    if (sigPhone) {
      signatureBlock += `\n${sigPhone}`;
    }

    // Get playbook from request body first, then try campaign
    let playbook: StructuredPlaybookCache | null = null;
    
    // Priority 1: Use playbook_data passed directly in request
    if (playbook_data && isStructuredCache(playbook_data)) {
      playbook = playbook_data;
      console.log("✅ Using playbook_data from request body");
      console.log("Playbook title:", playbook.metadata?.title);
      console.log("Hourly rate:", playbook.compensation?.hourly);
    }
    // Priority 2: Fetch from campaign if campaign_id provided
    else if (campaign_id) {
      console.log("Fetching playbook from campaign:", campaign_id);
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('playbook_data')
        .eq('id', campaign_id)
        .maybeSingle();
      
      if (campaign?.playbook_data && isStructuredCache(campaign.playbook_data)) {
        playbook = campaign.playbook_data;
        console.log("✅ Using structured playbook cache from campaign");
        console.log("Playbook title:", playbook.metadata?.title);
        console.log("Hourly rate:", playbook.compensation?.hourly);
      }
    }

    // Validate required compensation data
    if (!playbook) {
      throw new Error("NO PLAYBOOK FOUND - cannot generate message without playbook data. Please sync a playbook first.");
    }
    
    if (!playbook.compensation?.hourly && !playbook.compensation?.salary_range) {
      throw new Error("NO COMPENSATION FOUND - cannot generate message without verified hourly rate or salary range. Please ensure playbook contains compensation information.");
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

    // Check for existing personalization
    let hook = personalization_hook;
    if (!hook) {
      const { data: personalization } = await supabase
        .from('candidate_personalization')
        .select('email_opener, hooks')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      
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
      .maybeSingle();

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Build personalization hooks
    const credDays = playbook.credentialing?.days_to_credential ? `${playbook.credentialing.days_to_credential}-day` : "expedited";
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

    // Extract values from structured playbook with safe defaults
    const hourlyRate = playbook.compensation.hourly || playbook.compensation.salary_range || "Rate TBD";
    const dailyRate = playbook.compensation.daily || "";
    const weeklyRate = playbook.compensation.weekly || "";
    const annualRate = playbook.compensation.annual || "";
    
    const callStatus = playbook.clinical?.call_status || "flexible schedule";
    const schedule = playbook.clinical?.schedule_days && playbook.clinical?.schedule_hours 
      ? `${playbook.clinical.schedule_days} ${playbook.clinical.schedule_hours}`
      : playbook.clinical?.schedule_days || "Standard hours";
    const procedures = playbook.clinical?.procedures || `${candidate.specialty} procedures`;
    const volume = playbook.clinical?.volume || "sustainable volume";
    const duration = playbook.clinical?.duration || "";
    const techStack = playbook.clinical?.tech_stack || "Modern EMR";
    
    const facilityName = playbook.position?.facility_name || job.facility_name;
    const facilityType = playbook.position?.facility_type || "Hospital";
    const locationCity = playbook.position?.location_city || job.city;
    const locationState = playbook.position?.location_state || job.state;
    const contractType = playbook.position?.contract_type || "locums";
    
    const requiredLicense = playbook.credentialing?.required_license || locationState;
    const credentialingDays = playbook.credentialing?.days_to_credential || null;
    
    // Positioning guidance
    const sellingPoints = playbook.positioning?.selling_points || "";
    const idealCandidate = playbook.positioning?.ideal_candidate || "";
    const messagingTone = playbook.positioning?.messaging_tone || "";
    const differentiators = playbook.positioning?.differentiators || "";
    const objectionResponses = playbook.positioning?.objection_responses || "";
    const facilityContext = playbook.positioning?.facility_context || "";

    // Build compensation line for prompt
    let compLinePrompt = `${hourlyRate}`;
    if (dailyRate) compLinePrompt += ` | ${dailyRate}`;
    if (weeklyRate) compLinePrompt += ` | ${weeklyRate}`;

    // Build the clinical consultant prompt with structured data
    // CRITICAL: Accuracy rules at TOP so AI sees them first
    const systemPrompt = `=== CRITICAL ACCURACY RULES - FOLLOW EXACTLY ===

1. COMPENSATION: Use rates EXACTLY as provided in playbook data. Never calculate, round, or modify.
   - If playbook says "${hourlyRate}", write "${hourlyRate}" - never any other number
   - Daily/weekly/annual must match playbook exactly

2. FACILITY TYPE: This is a ${facilityType}.
   - NEVER say "Level I trauma" or "Level II trauma" unless playbook explicitly states it
   - NEVER assume trauma level - only use what playbook explicitly states
   - Say "community hospital" or "non-trauma center" if that's what the playbook says

3. CALL STATUS: Emphasize "${callStatus}" as the key differentiator - this is rare for IR positions

4. NO HALLUCINATION: Only include facts that exist in the playbook data.
   - Do not invent facility details, trauma designations, or teaching affiliations
   - Do not assume characteristics based on location (LA metro ≠ trauma center)
   - If information is not in the playbook, do not include it

5. TONE: Be direct and clinical, not salesy or recruiter-y.
   - Lead with the key differentiator (zero call, rate, or facility type)
   - Use specific numbers from playbook
   - Permission-based CTAs ("worth 15 min to discuss?" not "let's schedule a call!")

=== END CRITICAL RULES ===

${CLINICAL_CONSULTANT_PERSONA}

=== COMPENSATION (USE EXACTLY - NEVER CALCULATE OR MODIFY) ===
- Rate: ${hourlyRate}/hour
${dailyRate ? `- Daily: ${dailyRate}` : ''}
${weeklyRate ? `- Weekly: ${weeklyRate}` : ''}
${annualRate ? `- Annual: ${annualRate}` : ''}

=== CLINICAL ===
- Call: ${callStatus}
- Schedule: ${schedule}
- Procedures: ${procedures}
- Volume: ${volume}
${duration ? `- Duration: ${duration}` : ''}
- Tech: ${techStack}

=== POSITION (USE IN SUBJECT AND BODY) ===
- Position Title: ${playbook.position?.title || job.job_name || `${candidate.specialty} ${contractType}`}
- Facility: ${facilityName}
- Facility Type: ${facilityType} (NEVER invent trauma designation)
- Location: ${locationCity}, ${locationState}
- Metro Area: ${playbook.position?.location_metro || locationCity + ' metro'}
- Contract Type: ${contractType}

NOTE: Use position data for accurate subject lines and facility descriptions. Never assume trauma level or teaching status.

=== CREDENTIALING ===
- Required License: ${requiredLicense}
${credentialingDays ? `- Timeline: ${credentialingDays} days` : ''}
${playbook.credentialing?.temps_available ? '- Temps available while credentialing' : ''}

=== POSITIONING GUIDANCE (FOLLOW THIS) ===
${sellingPoints ? `Selling Points: ${sellingPoints}` : ''}
${idealCandidate ? `Ideal Candidate: ${idealCandidate}` : ''}
${messagingTone ? `Messaging Tone: ${messagingTone}` : ''}
${differentiators ? `Differentiators: ${differentiators}` : ''}
${objectionResponses ? `Objection Responses: ${objectionResponses}` : ''}
${facilityContext ? `Facility Context: ${facilityContext}` : ''}

=== CANDIDATE DATA ===
- Name: Dr. ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Location: ${candidate.city || ''}, ${candidate.state}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (includes ${job.state})` : ''}
- Current employer: ${candidate.company_name || 'Unknown'}

=== PERSONALIZATION HOOKS TO USE (at least 2) ===
${personalizationHooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}
${hook ? `\nADDITIONAL CONTEXT: ${hook}` : ''}
${custom_context ? `\nCUSTOM CONTEXT: ${custom_context}` : ''}
${jobMatch?.icebreaker ? `\nICEBREAKER: ${jobMatch.icebreaker}` : ''}

EMAIL STRUCTURE TO FOLLOW:
Subject: [Location] [Specialty] ${contractType} - [clinical detail], [call status], ${hourlyRate}/hr

Dr. [Last Name],

[OPENER: 1-2 sentences connecting THEIR specific background to this outreach. Reference their training, current employer, or experience. Never generic.]

Clinical Scope:
[Setting/facility type]
Case types: [SPECIFIC procedures]
Volume: [Volume info] ([sustainability comment])
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

${signatureBlock}`;

    console.log("Using signature:", sigFullName, sigTitle, sigCompany);

    // Fallback email generator - clinical consultant style
    const generateFallbackEmail = () => {
      const subject = `${locationCity}, ${locationState} ${candidate.specialty} ${contractType} - ${callStatus}, ${hourlyRate}/hr`;
      
      const body = `Dr. ${candidate.last_name},

${hasJobStateLicense 
  ? `Your ${job.state} license caught my attention - it means ${credentialingDays || 'expedited'}-day credentialing for this ${contractType} role.`
  : `Your ${candidate.specialty} background and ${licenseCount} state licenses suggest you'd be a strong fit for this ${contractType} position.`}

Clinical Scope:
${facilityType} setting at ${facilityName}
Case types: ${procedures}
Volume: ${volume}
Tech: ${techStack}
${callStatus ? `Call: ${callStatus}` : ''}

Schedule:
${schedule}
${duration ? `Duration: ${duration}` : ''}

Compensation:
${hourlyRate}/hour${dailyRate ? ` | ${dailyRate}/day` : ''}${weeklyRate ? ` | ${weeklyRate}/week` : ''}
${annualRate ? `Annual potential: ${annualRate}` : ''}

${credentialingDays ? `Credentialing: ${credentialingDays} days with your ${hasJobStateLicense ? job.state : 'active'} license.` : ''}

Worth 15 minutes to discuss clinical fit? If it's not the right match, I'll tell you directly.

${signatureBlock}`;

      return { subject, body };
    };

    // Try AI generation, fall back to template
    let email: { subject: string; body: string };
    let usedFallback = false;

    try {
      console.log("Calling Lovable AI Gateway for email generation...");
      
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
            { 
              role: "user", 
              content: `Generate a professional outreach email for Dr. ${candidate.last_name}. Return ONLY valid JSON with "subject" and "body" fields. No markdown, no code blocks.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        
        if (aiResponse.status === 402) {
          console.log("Credits exhausted - using fallback template");
          email = generateFallbackEmail();
          usedFallback = true;
        } else {
          throw new Error(`AI Gateway error: ${aiResponse.status}`);
        }
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        console.log("AI Response received, length:", content.length);
        
        // Parse JSON response
        let parsed: { subject?: string; body?: string } | null = null;
        try {
          // Try direct JSON parse
          const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(cleanContent);
        } catch {
          // Try to extract with regex
          const subjectMatch = content.match(/["']?subject["']?\s*:\s*["']([^"']+)["']/i);
          const bodyMatch = content.match(/["']?body["']?\s*:\s*["']([\s\S]+?)["'](?:\s*}|$)/i);
          
          if (subjectMatch && bodyMatch) {
            parsed = {
              subject: subjectMatch[1],
              body: bodyMatch[1].replace(/\\n/g, '\n'),
            };
          }
        }
        
        if (parsed?.subject && parsed?.body) {
          email = { subject: parsed.subject, body: parsed.body };
        } else {
          console.log("Failed to parse AI response, using fallback");
          email = generateFallbackEmail();
          usedFallback = true;
        }
      }
    } catch (aiError) {
      console.error("AI generation failed:", aiError);
      email = generateFallbackEmail();
      usedFallback = true;
    }

    // Return response with metadata for verification
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
          facility: job.facility_name,
          location: `${job.city}, ${job.state}`,
        },
        email,
        // Include rate metadata for verification
        rates_used: {
          hourly: playbook.compensation.hourly,
          daily: playbook.compensation.daily,
          weekly: playbook.compensation.weekly,
          annual: playbook.compensation.annual,
          salary_range: playbook.compensation.salary_range,
        },
        playbook_source: {
          title: playbook.metadata?.title,
          notion_id: playbook.metadata?.notion_id,
          synced_at: playbook.metadata?.synced_at,
        },
        positioning_used: {
          has_selling_points: !!playbook.positioning?.selling_points,
          has_messaging_tone: !!playbook.positioning?.messaging_tone,
          has_differentiators: !!playbook.positioning?.differentiators,
        },
        personalization_hooks: personalizationHooks,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Email generation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
