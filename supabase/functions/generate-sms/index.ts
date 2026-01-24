import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  candidate_id: string;
  job_id: string;
  template_style?: 'punchy' | 'friendly' | 'urgent' | 'value_prop';
  personalization_hook?: string;
  custom_context?: string;
  playbook_content?: string; // Notion playbook reference
}

interface CandidateData {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  licenses: string[];
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

// Professional SMS generation persona
const SMS_PERSONA = `You are a senior healthcare recruiter crafting brief, professional SMS messages.

YOUR SMS STYLE:
- Direct and respectful opener with Dr. + first name
- Lead with the key value (rate, location, schedule)
- Create genuine interest without being salesy
- Soft call-to-action (question, not demand)

FORBIDDEN:
- Emojis of any kind
- Generic greetings
- Pushy language ("Don't miss out!")
- Anything over 160 characters`;

const SMS_TEMPLATES = {
  punchy: `Generate a PUNCHY, direct SMS (max 155 chars) for a locums physician recruitment. 
Style: Short, impactful, creates urgency. No fluff.
Example: "Dr. {{first_name}} - $500/hr IR role in Houston. 80% procedures. Your fellowship = perfect fit. Quick call?"`,
  
  friendly: `Generate a FRIENDLY, conversational SMS (max 155 chars) for locums recruitment.
Style: Warm, personal, like a colleague reaching out.
Example: "Hi Dr. {{first_name}}! Saw your IR background - have an amazing Houston opportunity. Mind if I share details?"`,
  
  urgent: `Generate an URGENT SMS (max 155 chars) for time-sensitive locums opportunity.
Style: Creates FOMO, emphasizes scarcity.
Example: "Dr. {{first_name}} - Filling $500/hr IR locums THIS WEEK. Only 2 spots. Your licenses = instant start. Interested?"`,
  
  value_prop: `Generate a VALUE-FOCUSED SMS (max 155 chars) highlighting compensation.
Style: Lead with money, emphasize elite earning potential.
Example: "Dr. {{first_name}}: $1.17M/yr potential. IR locums, Houston. Your 24 licenses = flexibility. 5 min to discuss?"`
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

    const body: SMSRequest = await req.json();
    const { candidate_id, job_id, template_style = 'punchy', personalization_hook, custom_context, playbook_content } = body;

    // Fetch candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, specialty, state, licenses')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      throw new Error(`Candidate not found: ${candidateError?.message}`);
    }

    // Fetch job data - include pay_rate
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_name, facility_name, city, state, specialty, bill_rate, pay_rate')
      .eq('id', job_id)
      .single();

    // Use pay_rate for candidate-facing messages (not bill_rate)
    const payRate = job?.pay_rate || (job?.bill_rate ? job.bill_rate * 0.73 : null);

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
        .single();
      
      if (personalization?.email_opener) {
        hook = personalization.email_opener;
      }
    }

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Build system prompt with professional persona
    const systemPrompt = `${SMS_PERSONA}

${playbook_content ? `
RECRUITMENT PLAYBOOK REFERENCE:
Use the following playbook to inform your messaging style and value propositions:
---
${playbook_content.substring(0, 1500)}
---
` : ''}

CRITICAL RULES:
1. ALWAYS under 160 characters (SMS limit)
2. Use Dr. + first name (never full name)
3. Lead with the hook or value proposition
4. End with a soft CTA (question, not demand)
5. No emojis
6. Sound human, not robotic
7. Create curiosity or urgency

PERSONALIZATION DATA:
- Candidate: Dr. ${candidate.first_name} ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (includes ${job.state})` : ''}
- Job: ${job.job_name} at ${job.facility_name}
- Location: ${job.city}, ${job.state}
- Pay Rate: ${payRate ? `$${payRate}/hr` : 'Competitive'}
${hook ? `- Personalization Hook: ${hook}` : ''}
${custom_context ? `- Additional Context: ${custom_context}` : ''}`;

    const templateGuide = SMS_TEMPLATES[template_style] || SMS_TEMPLATES.punchy;

    // Fallback SMS generator when AI is unavailable
    const generateFallbackSMS = () => {
      const rate = payRate ? `$${payRate}/hr` : 'Top rate';
      const location = `${job.city}, ${job.state}`;
      
      const templates = {
        punchy: [
          { sms: `Dr. ${candidate.first_name} - ${rate} ${candidate.specialty} in ${location}. Your licenses = perfect fit. Quick call?`, style: 'punchy' },
          { sms: `Dr. ${candidate.first_name}: ${rate} locums opportunity. ${job.facility_name}, ${job.state}. Interested?`, style: 'direct' },
          { sms: `${rate} ${candidate.specialty} role at ${job.facility_name}. Dr. ${candidate.first_name}, 5 min to discuss?`, style: 'value' }
        ],
        friendly: [
          { sms: `Hi Dr. ${candidate.first_name}! Saw your ${candidate.specialty} background - have an amazing ${location} opportunity. Mind if I share details?`, style: 'warm' },
          { sms: `Dr. ${candidate.first_name}, thought of you for a ${candidate.specialty} role at ${job.facility_name}. Would love to chat!`, style: 'personal' },
          { sms: `Hey Dr. ${candidate.first_name}! Quick question - open to ${candidate.specialty} locums in ${job.state}? Great opportunity here.`, style: 'casual' }
        ],
        urgent: [
          { sms: `Dr. ${candidate.first_name} - Filling ${rate} ${candidate.specialty} locums THIS WEEK. ${job.state} license? Let's talk ASAP.`, style: 'urgent' },
          { sms: `URGENT: ${rate} ${candidate.specialty} at ${job.facility_name}. Immediate start. Dr. ${candidate.first_name}, available?`, style: 'critical' },
          { sms: `Dr. ${candidate.first_name}: Last spot for ${rate} ${candidate.specialty} in ${location}. Quick response needed!`, style: 'fomo' }
        ],
        value_prop: [
          { sms: `Dr. ${candidate.first_name}: ${rate} ${candidate.specialty} locums. ${job.facility_name}. Your ${licenseCount} licenses = flexibility. 5 min?`, style: 'value' },
          { sms: `${rate} + premium benefits. ${candidate.specialty} at ${job.facility_name}, ${job.state}. Dr. ${candidate.first_name}, interested?`, style: 'comp' },
          { sms: `Dr. ${candidate.first_name} - Elite ${candidate.specialty} opportunity: ${rate}, ${location}. Your experience is ideal. Chat?`, style: 'premium' }
        ]
      };
      
      return templates[template_style] || templates.punchy;
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
            { role: "user", content: `${templateGuide}\n\nGenerate 3 different SMS options for this candidate. Return ONLY a JSON array with objects containing "sms" (the message) and "style" (one-word description). Example: [{"sms": "Dr. John - $500/hr IR...", "style": "urgent"}]` }
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

    // Ensure all messages are under 160 chars
    smsOptions = smsOptions.map((opt: { sms: string; style: string }) => ({
      ...opt,
      sms: opt.sms.length > 160 ? opt.sms.substring(0, 157) + '...' : opt.sms,
      char_count: Math.min(opt.sms.length, 160)
    }));

    return new Response(
      JSON.stringify({
        success: true,
        candidate: {
          id: candidate.id,
          name: `Dr. ${candidate.first_name} ${candidate.last_name}`,
          specialty: candidate.specialty,
        },
        job: {
          id: job.id,
          name: job.job_name,
          location: `${job.city}, ${job.state}`,
        },
        sms_options: smsOptions,
        template_style,
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
