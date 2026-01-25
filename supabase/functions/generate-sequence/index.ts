import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SequenceRequest {
  job_id: string;
  initial_email_subject: string;
  initial_email_body: string;
  initial_sms: string;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    specialty?: string;
  };
  job: {
    specialty?: string;
    facility_name?: string;
    city?: string;
    state?: string;
    pay_rate?: number;
  };
  playbook_data?: Record<string, unknown>;
}

interface SequenceStep {
  day: number;
  channel: 'email' | 'sms';
  type: 'followup';
  subject?: string;
  content: string;
}

// Clinical consultant persona - no recruiter language
const CLINICAL_CONSULTANT_PERSONA = `You are a Clinical Consultant (NOT a recruiter) helping physicians evaluate locum tenens opportunities.
Your tone is:
- Professional and direct, like a colleague sharing information
- No exclamation marks, no emojis, no sales language
- Address physicians as "Dr. {last_name}" 
- Focus on clinical details (call burden, procedure mix, facility type)
- Keep messaging concise and respectful of their time

CRITICAL ACCURACY RULES:
- Use EXACT rates provided - never calculate or estimate
- Never use words: "exciting", "amazing", "incredible", "elite", "rockstar"
- Never use urgency tactics: "limited time", "act now", "don't miss"
- Each follow-up MUST reference the initial outreach naturally`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      job_id,
      initial_email_subject,
      initial_email_body,
      initial_sms,
      candidate,
      job,
      playbook_data,
    }: SequenceRequest = await req.json();

    if (!candidate || !job) {
      return new Response(
        JSON.stringify({ error: "Missing candidate or job data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    // Extract key info for follow-ups
    const payRate = job.pay_rate || 500;
    const location = `${job.city || ''}, ${job.state || ''}`.replace(/^, |, $/g, '');
    const facilityName = job.facility_name || 'the facility';
    const specialty = job.specialty || 'locum tenens';

    // Build context from initial messages
    const initialContext = `
INITIAL EMAIL SUBJECT: ${initial_email_subject || 'N/A'}
INITIAL EMAIL BODY (first 500 chars): ${initial_email_body?.substring(0, 500) || 'N/A'}
INITIAL SMS: ${initial_sms || 'N/A'}
`;

    const systemPrompt = `${CLINICAL_CONSULTANT_PERSONA}

JOB DATA:
- Specialty: ${specialty}
- Pay Rate: $${payRate}/hr (USE EXACTLY - DO NOT CHANGE)
- Location: ${location}
- Facility: ${facilityName}

CANDIDATE: Dr. ${candidate.last_name}

${initialContext}

Generate follow-up messages that build on the initial outreach. Each follow-up should:
1. Reference the previous communication naturally
2. Provide a different angle or benefit
3. Get progressively shorter
4. Never repeat the same information verbatim`;

    const userPrompt = `Generate 3 follow-up messages for this campaign sequence:

1. DAY 3 EMAIL FOLLOW-UP: Brief check-in referencing your initial email about the ${specialty} opportunity. 3-4 sentences max.

2. DAY 5 SMS FOLLOW-UP: Short nudge (under 160 characters) that references your previous outreach.

3. DAY 7 EMAIL FOLLOW-UP: Final professional note. 2-3 sentences. Closing window angle without being pushy.

Return as JSON array with this structure:
[
  { "day": 3, "channel": "email", "subject": "string under 50 chars", "content": "email body" },
  { "day": 5, "channel": "sms", "content": "sms under 160 chars" },
  { "day": 7, "channel": "email", "subject": "string under 50 chars", "content": "email body" }
]

Use "Dr. ${candidate.last_name}" as the salutation. Do NOT include a signature - it will be added automatically.`;

    let sequenceSteps: SequenceStep[] = [];

    if (LOVABLE_API_KEY) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          
          // Parse JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            sequenceSteps = parsed.map((step: SequenceStep) => ({
              ...step,
              type: 'followup' as const,
              // Ensure SMS is under 160 chars
              content: step.channel === 'sms' 
                ? step.content.substring(0, 160) 
                : step.content,
            }));
          }
        } else if (response.status === 402 || response.status === 429) {
          console.log("AI credits exhausted or rate limited, using fallback");
        }
      } catch (aiError) {
        console.error("AI generation error:", aiError);
      }
    }

    // Fallback if AI failed or no API key
    if (sequenceSteps.length === 0) {
      sequenceSteps = [
        {
          day: 3,
          channel: 'email',
          type: 'followup',
          subject: `Following up - ${specialty} in ${job.state || 'your area'}`,
          content: `Dr. ${candidate.last_name},

Just following up on my previous note about the ${specialty} opportunity at ${facilityName}.

The $${payRate}/hr rate is still available. Would 10 minutes work this week to discuss?

Best,`,
        },
        {
          day: 5,
          channel: 'sms',
          type: 'followup',
          content: `Dr. ${candidate.last_name}, quick follow-up on the ${job.state || ''} ${specialty} role at $${payRate}/hr. Still interested?`,
        },
        {
          day: 7,
          channel: 'email',
          type: 'followup',
          subject: `Final check-in - ${specialty} opportunity`,
          content: `Dr. ${candidate.last_name},

Last note on the ${specialty} position in ${location}. The $${payRate}/hr opportunity is still open if your situation has changed.

Happy to share details whenever convenient.

Best,`,
        },
      ];
    }

    // Validate SMS length
    sequenceSteps = sequenceSteps.map(step => ({
      ...step,
      content: step.channel === 'sms' 
        ? step.content.substring(0, 160)
        : step.content,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        sequence_steps: sequenceSteps,
        candidate_id: candidate.id,
        job_id,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate sequence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
