import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  candidate_id: string;
  job_id: string;
  template_type: 'initial' | 'followup' | 'value_prop' | 'fellowship' | 'custom';
  personalization_hook?: string;
  custom_instructions?: string;
  include_full_details?: boolean;
}

const EMAIL_PLAYBOOKS = {
  fellowship: `Generate a DETAILED email for an IR FELLOWSHIP-TRAINED RADIOLOGIST. Include:
- Recognition of their fellowship training
- Specific procedural scope (thrombectomy, angio, biopsies, drains)
- Elite compensation breakdown (hourly, daily, weekly, annual)
- Schedule details (M-F, call frequency)
- Location benefits (Texas no income tax, cost of living)
- Why their training = competitive advantage
- Clear next steps`,

  value_prop: `Generate a VALUE-FOCUSED email emphasizing compensation. Include:
- Lead with the money ($X/hr = $Y annual)
- Financial comparison to typical employed position
- Tax advantages if applicable
- Work-life balance benefits
- Flexibility of locums
- Geographic arbitrage opportunity`,

  initial: `Generate a PROFESSIONAL INITIAL OUTREACH email. Include:
- Personal connection (reference their background/specialty)
- Brief opportunity overview
- Key differentiators (rate, location, scope)
- Soft call-to-action
- Professional signature`,

  followup: `Generate a FOLLOW-UP email for someone who hasn't responded. Include:
- Reference to previous outreach
- New angle or additional value
- Urgency without pressure
- Easy response options
- Brief and respectful tone`,

  custom: `Generate a personalized email based on the provided instructions.`
};

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
    const { 
      candidate_id, 
      job_id, 
      template_type = 'initial', 
      personalization_hook, 
      custom_instructions,
      include_full_details = false 
    } = body;

    // Fetch candidate with research data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select(`
        id, first_name, last_name, specialty, state, city, licenses, npi,
        years_of_experience, board_certified, email, personal_email
      `)
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      throw new Error(`Candidate not found: ${candidateError?.message}`);
    }

    // Fetch candidate research
    const { data: research } = await supabase
      .from('candidate_research')
      .select('*')
      .eq('candidate_id', candidate_id)
      .single();

    // Fetch job match data
    const { data: jobMatch } = await supabase
      .from('candidate_job_matches')
      .select('*')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .single();

    // Fetch job data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Fetch personalization hooks if not provided
    let hook = personalization_hook;
    if (!hook) {
      const { data: personalization } = await supabase
        .from('candidate_personalization')
        .select('email_opener, hooks, linkedin_note')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .single();
      
      if (personalization?.email_opener) {
        hook = personalization.email_opener;
      }
    }

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);
    const hasIMLCLicense = research?.has_imlc || false;

    // Calculate compensation details
    const hourlyRate = job.bill_rate || 0;
    const dailyRate = hourlyRate * 9;
    const weeklyRate = dailyRate * 5;
    const annualPotential = weeklyRate * 52;

    const systemPrompt = `You are an expert healthcare recruitment copywriter creating personalized emails for physician locums opportunities. Your emails are detailed, compelling, and data-driven.

CRITICAL RULES:
1. Use markdown formatting for structure (headers, bullets, bold)
2. Personalize based on candidate background
3. Include specific numbers (compensation, RVUs, schedule)
4. Professional but engaging tone
5. Clear call-to-action
6. Reference their specific qualifications

CANDIDATE PROFILE:
- Name: Dr. ${candidate.first_name} ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Location: ${candidate.city || 'Unknown'}, ${candidate.state || 'Unknown'}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (includes ${job.state} ✓)` : ''}${hasIMLCLicense ? ' (IMLC ✓)' : ''}
- Experience: ${candidate.years_of_experience ? `${candidate.years_of_experience} years` : 'Experienced'}
- Board Certified: ${candidate.board_certified ? 'Yes' : 'Unknown'}
${research?.credentials_summary ? `- Credentials: ${research.credentials_summary}` : ''}
${research?.professional_highlights?.length ? `- Highlights: ${research.professional_highlights.join(', ')}` : ''}

JOB DETAILS:
- Position: ${job.job_name}
- Facility: ${job.facility_name}
- Location: ${job.city}, ${job.state}
- Specialty: ${job.specialty}
- Compensation: $${hourlyRate}/hour
  - Daily: $${dailyRate.toLocaleString()} (9-hour day)
  - Weekly: $${weeklyRate.toLocaleString()} (M-F)
  - Annual Potential: $${annualPotential.toLocaleString()}
${job.start_date ? `- Start Date: ${job.start_date}` : ''}

MATCH ANALYSIS:
${jobMatch?.match_score ? `- Match Score: ${jobMatch.match_score}%` : ''}
${jobMatch?.match_reasons?.length ? `- Strengths: ${jobMatch.match_reasons.join(', ')}` : ''}
${jobMatch?.icebreaker ? `- Icebreaker: ${jobMatch.icebreaker}` : ''}
${jobMatch?.talking_points?.length ? `- Talking Points: ${jobMatch.talking_points.join('; ')}` : ''}
${hook ? `- Personalization Hook: ${hook}` : ''}

LICENSE ADVANTAGE:
${hasJobStateLicense ? `✓ Already licensed in ${job.state} - priority credentialing available` : hasIMLCLicense ? '✓ IMLC license - expedited Texas licensing available' : `○ May need ${job.state} license (90-day credentialing standard)`}`;

    const playbook = EMAIL_PLAYBOOKS[template_type] || EMAIL_PLAYBOOKS.initial;
    const userPrompt = `${playbook}

${custom_instructions ? `ADDITIONAL INSTRUCTIONS: ${custom_instructions}` : ''}

${include_full_details ? 'Include COMPREHENSIVE details about compensation breakdown, scope of work, schedule, location benefits, requirements, and credentialing process.' : 'Keep the email concise but compelling.'}

Generate the email with:
1. A compelling subject line
2. The email body in markdown format

Return as JSON: {"subject": "...", "body": "..."}`;

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    let emailResult = { subject: '', body: '' };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        emailResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Use content as body if JSON parsing fails
      emailResult = {
        subject: `${job.specialty} Opportunity - ${job.city}, ${job.state}`,
        body: content
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        candidate: {
          id: candidate.id,
          name: `Dr. ${candidate.first_name} ${candidate.last_name}`,
          specialty: candidate.specialty,
          email: candidate.email || candidate.personal_email,
        },
        job: {
          id: job.id,
          name: job.job_name,
          location: `${job.city}, ${job.state}`,
          rate: hourlyRate,
        },
        email: emailResult,
        template_type,
        personalization_used: !!hook,
        match_score: jobMatch?.match_score,
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
