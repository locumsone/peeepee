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

// Connection object from personalization-research engine
interface ConnectionMatch {
  priority: number;      // 1-8, lower = stronger
  fact: string;          // What we found about candidate
  benefit: string;       // Why this role fits them
  line: string;          // Full connection sentence for email
  smsLine: string;       // Compressed 40-char version for SMS
}

interface EmailRequest {
  candidate_id: string;
  job_id: string;
  campaign_id?: string;
  personalization_hook?: string;
  custom_context?: string;
  playbook_data?: StructuredPlaybookCache; // Allow passing structured playbook directly
  signature?: UserSignature; // User signature for email sign-off
  connection?: ConnectionMatch | null; // Connection from personalization engine
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
    trauma_level: string | null;
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
    const { candidate_id, job_id, campaign_id, personalization_hook, custom_context, playbook_data, signature, connection } = body;
    
    // Build signature block (use provided or default)
    // Fix: Don't duplicate company name if title already contains it
    const sigFullName = signature?.full_name || 'Your Locums One Team';
    const sigTitle = signature?.title || 'Clinical Consultant';
    const sigCompany = signature?.company || 'Locums One';
    const sigPhone = signature?.phone || null;
    
    // Build clean signature - don't repeat company if it's already in title or name
    const showCompany = !sigFullName.toLowerCase().includes('locums one') && 
                        !sigTitle.toLowerCase().includes('locums one');
    
    let signatureBlock = `Best regards,\n${sigFullName}\n${sigTitle}`;
    if (showCompany) {
      signatureBlock += `\n${sigCompany}`;
    }
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
    const facilityType = playbook.position?.facility_type || null;
    const traumaLevel = playbook.position?.trauma_level || null;
    const locationCity = playbook.position?.location_city || job.city;
    const locationState = playbook.position?.location_state || job.state;
    const locationMetro = playbook.position?.location_metro || locationCity;
    const contractType = playbook.position?.contract_type || "locums";
    const specialty = job.specialty || candidate.specialty || "Physician";
    
    // Abbreviate specialty for subject line (doctors know these abbreviations)
    const getSpecialtyAbbrev = (spec: string): string => {
      const abbrevMap: Record<string, string> = {
        'interventional radiology': 'IR',
        'diagnostic radiology': 'DR',
        'emergency medicine': 'EM',
        'internal medicine': 'IM',
        'family medicine': 'FM',
        'obstetrics and gynecology': 'OB/GYN',
        'anesthesiology': 'Anesthesia',
        'hospitalist': 'Hospitalist',
        'psychiatry': 'Psych',
        'orthopedic surgery': 'Ortho',
        'general surgery': 'Surgery',
        'cardiology': 'Cards',
        'gastroenterology': 'GI',
        'pulmonology': 'Pulm',
        'nephrology': 'Nephro',
        'neurology': 'Neuro',
        'oncology': 'Onc',
        'urology': 'Uro',
      };
      const lower = spec.toLowerCase();
      for (const [full, abbrev] of Object.entries(abbrevMap)) {
        if (lower.includes(full)) return abbrev;
      }
      // Return first word if no match (e.g., "Pediatrics" -> "Pediatrics")
      return spec.split(' ')[0];
    };
    const specialtyAbbrev = getSpecialtyAbbrev(specialty);
    
    // Keep specialty abbreviation for AI to use in subject generation
    // (AI will use this in the dynamic subject line)
    
    // Derive facility description from trauma_level
    const getFacilityDescription = (): string => {
      if (traumaLevel === "None") return facilityType || "Non-trauma hospital";
      if (traumaLevel && traumaLevel !== "None") return facilityType || `${traumaLevel} Trauma Center`;
      return facilityType || "Hospital";
    };
    const facilityDescription = getFacilityDescription();
    
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
    const systemPrompt = `=== FACILITY DATA (USE EXACTLY AS PROVIDED - NEVER INVENT) ===
- Facility Name: ${facilityName}
- Facility Type: ${facilityDescription}
- Trauma Level: ${traumaLevel || "Not specified - DO NOT ASSUME ANY TRAUMA LEVEL"}
- Location: ${locationCity}, ${locationState}
- Metro Area: ${locationMetro}
- Contract Type: ${contractType}

CRITICAL: When describing the facility, use the FACILITY DATA fields exactly as provided above.
- If Trauma Level is "None" or "Not specified", NEVER mention trauma in any way
- If Trauma Level is "None", describe as "${facilityDescription}"
- Do not infer or assume facility characteristics from location (e.g., LA metro ≠ trauma center)

=== ADDITIONAL ACCURACY RULES ===

1. COMPENSATION: Use rates EXACTLY as provided. Never calculate, round, or modify.
   - If playbook says "${hourlyRate}", write "${hourlyRate}" - never any other number

2. CALL STATUS: "${callStatus}" is a key differentiator - highlight prominently

3. NO HALLUCINATION: Only include facts from this prompt data.
   - Never invent teaching affiliations, trauma designations, or clinical details
   - If data is missing, omit it rather than guess

=== SUBJECT LINE (DETERMINISTIC - CODE-GENERATED) ===

The subject line is generated deterministically in code using this format:
"${locationCity} ${specialtyAbbrev} Locums - ${callStatus || 'see details'}, ${hourlyRate}/hr"

This subject line will be used: "${locationCity} ${specialtyAbbrev} Locums - ${callStatus || 'Flexible'}, ${hourlyRate}/hr"

Do NOT generate a subject line in your response. Only generate the email body.

=== END CRITICAL RULES ===

${CLINICAL_CONSULTANT_PERSONA}

=== COMPENSATION (USE EXACTLY - NEVER CALCULATE) ===
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

=== POSITION ===
- Position Title: ${playbook.position?.title || job.job_name || `${candidate.specialty} ${contractType}`}

=== CREDENTIALING ===
- Required License: ${requiredLicense}
${credentialingDays ? `- Timeline: ${credentialingDays} days` : ''}
${playbook.credentialing?.temps_available ? '- Temps available while credentialing' : ''}

=== POSITIONING GUIDANCE (USE FOR SUBJECT LINE & BODY) ===
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

=== ABSOLUTE RULES (NEVER VIOLATE) ===

1. NEVER use "I noticed" or "I saw" or "caught my attention" or "I came across"
2. NEVER bury personalization after paragraph 1
3. If CONNECTION provided → it MUST be in sentence 1 or 2 (see below)
4. If NO CONNECTION → use SHORT-FORM template (100-150 words max, no forced personalization)
5. All compensation figures must match playbook EXACTLY
6. No exclamation points. No emojis. No recruiter-speak.

=== CONNECTION-FIRST STRUCTURE ===

${connection ? `
## CONNECTION FOUND (Priority ${connection.priority})
The following connection MUST appear in SENTENCE 1 or 2 of the email body.

CONNECTION LINE (USE IN FIRST SENTENCE):
"Dr. ${candidate.last_name}, ${connection.line}"

FACT: ${connection.fact}
BENEFIT: ${connection.benefit}

REQUIRED EMAIL STRUCTURE (follow exactly):
1. SENTENCE 1: "Dr. ${candidate.last_name}, ${connection.line}" (MANDATORY - use this exact line)
2. SENTENCE 2-3: Brief reinforcement of why this matters + role differentiator
3. Compensation (one line): ${compLinePrompt}
4. Clinical scope (2-3 sentences max)
5. Credentialing: ${credDays} days vs. typical 90-120
6. CTA: "Worth 15 minutes to discuss fit?"

TOTAL LENGTH: 150-200 words max
` : `
## NO CONNECTION FOUND - USE SHORT-FORM TEMPLATE

Since no direct connection between this candidate and role was found, use the SHORT-FORM differentiator-first template:

REQUIRED SHORT-FORM STRUCTURE:
1. Lead with role's #1 differentiator (from SELLING POINTS): "${callStatus}" or "${differentiators?.split(',')[0] || 'competitive rate'}"
2. Compensation: ${compLinePrompt}
3. Credentialing comparison: ${credDays} days vs. typical 90-120
4. CTA: "Worth 15 minutes to discuss fit?"

TOTAL: 100-150 words MAX. Do NOT force weak personalization.

SHORT-FORM TEMPLATE:
"Dr. ${candidate.last_name},

${hourlyRate}/hr ${candidate.specialty || 'physician'} locums in ${locationCity}: ${callStatus}, ${schedule}.

${procedures}.

${credDays} credentialing vs. typical 90-120.

Worth 15 min to discuss fit?

${signatureBlock}"
`}

=== BAD OPENERS (NEVER USE) ===
- "I noticed your work at [hospital]..."
- "I came across your profile..."
- "I wanted to reach out about..."
- "I'm excited to share..."
- "Your background caught my attention..."
- Any generic flattery before the connection line

---

## MESSAGING TONE RULES

1. **Direct and clinical, not salesy or recruiter-y**
2. **Use specific numbers** ($500/hr, $4,500/day, 40 days)
3. **Lead with what's RARE**, not what's standard
4. **Reference pain points the role solves**, not just features
5. **If a selling point says "don't oversell X"—don't**
6. **Never use "Level I trauma" or "Level II trauma" unless explicitly stated—say "non-trauma" instead**

---

## DATA TO USE

Pull from these fields in the role data:
- SELLING POINTS → Opening hook + key differentiators
- PAIN POINTS SOLVED → Lifestyle benefits
- IDEAL CANDIDATE → Personalization hooks
- DIFFERENTIATORS → What makes this rare
- MESSAGING TONE → Specific language rules
- OBJECTION RESPONSES → Anticipate concerns

---

## WHAT TO AVOID

❌ Opening with "I noticed your work at [hospital]..."
❌ Burying the #1 differentiator in paragraph 3
❌ Generic "Why I'm reaching out to you specifically" sections
❌ Listing clinical scope before lifestyle benefits
❌ Saying credentialing time without comparison to standard
❌ Overselling features that are market-standard
❌ Multiple questions in CTA
❌ Overly formatted bullet points when prose works better
❌ Exclamation points
❌ Emojis
❌ Words: exciting, elite, amazing, fantastic, incredible, opportunity

---

## LENGTH REQUIREMENTS

- Total body: 150-220 words (scannable, not overwhelming)
- Opening hook: 2 sentences max
- Each section: 2-3 lines max (prose, not bullets unless truly scannable)
- Closer: 1-2 sentences max

---

## QUALITY SCORE RUBRIC (Must score 8/10 minimum)

### Structure (4 points)
- Opens with differentiator, not flattery: +1
- Pain point solved in first 3 sentences: +1
- Credentialing includes comparison (e.g., "40 days vs. typical 90-120"): +1
- CTA is permission-based, single question: +1

### Accuracy (3 points)
- All compensation figures correct (exact rates from playbook): +1
- Facility type/details accurate (no invented trauma levels): +1
- Schedule and call status accurate: +1

### Tone (2 points)
- Clinical, not salesy (zero recruiter words): +1
- Follows role-specific MESSAGING TONE rules: +1

### Differentiation (1 point)
- #1 differentiator framed as RARE (not standard): +1

**MINIMUM PASSING SCORE: 8/10**
If score < 8, REVISE before returning.

---

## SUBJECT LINE FORMAT

Under 50 characters. Lead with location + specialty + differentiator + rate.
Example: "Lakewood IR - No Call, $500/hr"

---

## EMAIL TEMPLATE

Subject: ${locationCity} ${specialtyAbbrev} - [differentiator], ${hourlyRate}/hr

Dr. [Last Name],

[OPENING HOOK: Lead with the #1 rare thing. Pattern: "[Rare thing] + [context]"]

[LIFESTYLE BENEFIT: What they escape + what they gain. 1-2 sentences.]

[LOCATION ADVANTAGE if applicable. 1 sentence.]

[COMPENSATION: Brief. ${compLinePrompt}${annualRate ? ` | Annual: ${annualRate}` : ''}]

[CLINICAL SCOPE: Brief, specific procedures. 2-3 sentences max.]

[CREDENTIALING: Timeline vs. standard + their license advantage. 1 sentence.]

[PERSONALIZATION: Connect their background to this role. 1-2 sentences.]

[CTA: Permission-based, low pressure. "Worth 15 minutes to discuss?" or similar.]

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
              content: `Generate email BODY ONLY for Dr. ${candidate.last_name}.

SUBJECT LINE IS PRE-GENERATED (do not include in response).

BODY STRUCTURE (in this order):
1. OPENING HOOK: Lead with the #1 rare thing from SELLING POINTS. NOT "I noticed your work..."
2. LIFESTYLE BENEFIT: What they escape + what they gain (from PAIN POINTS SOLVED)
3. LOCATION ADVANTAGE: If relevant, explain why the location matters
4. COMPENSATION: Brief - ${hourlyRate}/hr${dailyRate ? ` | ${dailyRate}` : ''}${weeklyRate ? ` | ${weeklyRate}` : ''}
5. CLINICAL SCOPE: Specific procedures, case mix. 2-3 sentences.
6. CREDENTIALING: "${credentialingDays || '40'} days vs. typical 90-120" + their license advantage
7. PERSONALIZATION: Connect ${candidate.company_name || candidate.state + ' license'} to this role. 1 sentence.
8. CTA: "Worth 15 minutes to discuss?" or similar. Permission-based.

SELLING POINTS: ${sellingPoints || callStatus}
PAIN POINTS SOLVED: ${playbook.positioning?.pain_points_solved || 'escape call burden, sustainable volume'}

LENGTH: 150-220 words.

Return ONLY valid JSON: {"body": "..."}`
            }
          ],
          temperature: 0.4,
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
        
        // Deterministic subject line - generated in code, not by AI
        const deterministicSubject = `${locationCity} ${specialtyAbbrev} Locums - ${callStatus || 'Flexible'}, ${hourlyRate}/hr`.substring(0, 55);
        
        // Parse JSON response - only need body now
        let parsedBody: string | null = null;
        try {
          const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
          const parsed = JSON.parse(cleanContent);
          parsedBody = parsed.body;
        } catch {
          // Try to extract body with regex
          const bodyMatch = content.match(/["']?body["']?\s*:\s*["']([\s\S]+?)["'](?:\s*}|$)/i);
          if (bodyMatch) {
            parsedBody = bodyMatch[1].replace(/\\n/g, '\n');
          }
        }
        
        if (parsedBody) {
          email = { subject: deterministicSubject, body: parsedBody };
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
