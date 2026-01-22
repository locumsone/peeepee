import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaybookRequest {
  job_id: string;
  sections?: string[]; // Which sections to generate
}

interface JobData {
  id: string;
  job_name: string;
  facility_name: string;
  city: string;
  state: string;
  specialty: string;
  bill_rate: number;
  pay_rate?: number;
  start_date?: string;
  job_requirements?: string;
  description?: string;
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

    const body: PlaybookRequest = await req.json();
    const { job_id, sections = ['overview', 'hooks', 'sms', 'emails', 'objections', 'linkedin'] } = body;

    // Fetch job data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Calculate compensation
    const hourlyRate = job.bill_rate || 0;
    const dailyRate = hourlyRate * 9;
    const weeklyRate = dailyRate * 5;
    const monthlyRate = weeklyRate * 4.3;
    const annualRate = weeklyRate * 52;

    const systemPrompt = `You are an expert healthcare recruitment strategist creating comprehensive playbooks for physician locums opportunities. Your playbooks are detailed, data-driven, and highly actionable.

JOB DETAILS:
- Position: ${job.job_name}
- Facility: ${job.facility_name}
- Location: ${job.city}, ${job.state}
- Specialty: ${job.specialty}
- Hourly Rate: $${hourlyRate}
- Daily Rate: $${dailyRate.toLocaleString()} (9 hours)
- Weekly Rate: $${weeklyRate.toLocaleString()} (M-F)
- Monthly Rate: $${monthlyRate.toLocaleString()}
- Annual Potential: $${annualRate.toLocaleString()} (52 weeks)
${job.start_date ? `- Start Date: ${job.start_date}` : ''}
${job.description ? `- Description: ${job.description}` : ''}
${job.job_requirements ? `- Requirements: ${job.job_requirements}` : ''}

Generate content that is:
1. Highly specific to this job and specialty
2. Uses actual numbers and data
3. Compelling and persuasive
4. Professional but engaging`;

    const playbook: Record<string, unknown> = {
      job_id: job.id,
      job_name: job.job_name,
      facility: job.facility_name,
      location: `${job.city}, ${job.state}`,
      compensation: {
        hourly: hourlyRate,
        daily: dailyRate,
        weekly: weeklyRate,
        monthly: Math.round(monthlyRate),
        annual: annualRate,
      },
    };

    // Generate SMS Templates (the missing piece!)
    if (sections.includes('sms')) {
      const smsPrompt = `Generate 6 punchy SMS templates for recruiting ${job.specialty} physicians for this locums opportunity. Each SMS must be under 155 characters.

Create templates for these scenarios:
1. Initial Outreach (punchy, curiosity-inducing)
2. Fellowship-Trained Specialist (reference their training)
3. Value Proposition (lead with money)
4. License Holder (they have state license - priority)
5. Follow-up (after no response)
6. Urgent/FOMO (creates scarcity)

Return as JSON array: [{"name": "...", "category": "...", "template": "...", "char_count": N}]`;

      const smsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: smsPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (smsResponse.ok) {
        const smsData = await smsResponse.json();
        const smsContent = smsData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = smsContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            playbook.sms_templates = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse SMS templates:", e);
        }
      }
    }

    // Generate Personalization Hooks
    if (sections.includes('hooks')) {
      const hooksPrompt = `Generate 10 personalization hooks for recruiting ${job.specialty} physicians. Each hook should:
1. Have a clear USE CASE (when to use it)
2. Have a PATTERN (template structure)
3. Have 2 EXAMPLE variations

Create hooks for:
1. Specialty Training (fellowship, certifications)
2. Elite Compensation ($${hourlyRate}/hr = $${annualRate.toLocaleString()} annual)
3. Scope of Practice (procedures, mix)
4. Location Benefits (${job.city}, ${job.state})
5. Long-Term Stability
6. Schedule/Work-Life Balance
7. License Priority (state license/IMLC)
8. Full Procedural Scope
9. Health System Prestige
10. Fast Start (emergency temps)

Return as JSON array: [{"name": "...", "use_case": "...", "pattern": "...", "examples": ["...", "..."]}]`;

      const hooksResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: hooksPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (hooksResponse.ok) {
        const hooksData = await hooksResponse.json();
        const hooksContent = hooksData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = hooksContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            playbook.personalization_hooks = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse hooks:", e);
        }
      }
    }

    // Generate Objection Handling
    if (sections.includes('objections')) {
      const objectionsPrompt = `Generate 6 common objections and responses for recruiting ${job.specialty} physicians for locums in ${job.city}, ${job.state} at $${hourlyRate}/hr.

Common objections:
1. "I don't have ${job.state} license"
2. "Locums seems unstable"
3. "The location isn't ideal"
4. "Call coverage seems heavy"
5. "I'm happy in my current role"
6. "The rate seems too good to be true"

For each, provide a compelling 2-3 sentence response that addresses the concern and redirects to the opportunity's strengths.

Return as JSON array: [{"objection": "...", "response": "..."}]`;

      const objResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: objectionsPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (objResponse.ok) {
        const objData = await objResponse.json();
        const objContent = objData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = objContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            playbook.objection_handling = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse objections:", e);
        }
      }
    }

    // Generate LinkedIn Search Criteria
    if (sections.includes('linkedin')) {
      playbook.linkedin_criteria = {
        job_titles: [
          job.specialty,
          `${job.specialty} Physician`,
          `${job.specialty} Specialist`,
          "Locums Physician",
          "Travel Physician",
        ],
        keywords_include: [
          job.specialty,
          "Board Certified",
          "Fellowship",
          `${job.state} license`,
          "IMLC",
          "Locums",
        ],
        keywords_exclude: [
          "Resident",
          "Fellow (current)",
          "Medical Student",
          "Retired",
          "Non-clinical",
        ],
        locations: [
          job.state,
          "Nationwide (IMLC states)",
          "High-cost markets (CA, NY, MA)",
        ],
        filters: {
          experience: "3+ years post-training",
          industry: ["Hospital & Health Care", "Medical Practice"],
          open_to_work: true,
        },
      };
    }

    // Generate key selling points
    playbook.key_selling_points = [
      `Elite Compensation: $${hourlyRate}/hr = $${dailyRate.toLocaleString()}/day = $${annualRate.toLocaleString()} annually`,
      `Location: ${job.city}, ${job.state}`,
      `Facility: ${job.facility_name}`,
      `Specialty: ${job.specialty}`,
      job.start_date ? `Start Date: ${job.start_date}` : null,
    ].filter(Boolean);

    // Candidate priority tiers
    playbook.candidate_tiers = [
      { tier: 1, description: `${job.specialty} specialist with ${job.state} license`, priority: "IMMEDIATE" },
      { tier: 2, description: `${job.specialty} specialist with IMLC`, priority: "FAST" },
      { tier: 3, description: `${job.specialty} specialist, any state`, priority: "DISCUSS LICENSE" },
      { tier: 4, description: `Related specialty with relevant experience + ${job.state} license`, priority: "CONSIDER" },
      { tier: 5, description: "Recently completed training", priority: "DEVELOPMENTAL" },
    ];

    return new Response(
      JSON.stringify({
        success: true,
        playbook,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Playbook generation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
