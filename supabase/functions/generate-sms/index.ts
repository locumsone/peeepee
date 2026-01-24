import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  candidate_id: string;
  job_id: string;
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

// Extract playbook rates
function extractPlaybookRates(playbookContent: string): {
  hourly: string;
  daily: string;
  weekly: string;
} {
  const defaults = { hourly: "$500", daily: "$4,500", weekly: "$22,500" };
  if (!playbookContent) return defaults;

  const hourlyMatch = playbookContent.match(/Hourly[:\s]*\*?\*?\$?([\d,]+)/i);
  const dailyMatch = playbookContent.match(/Daily[:\s]*\*?\*?\$?([\d,]+)/i);
  const weeklyMatch = playbookContent.match(/Weekly[:\s]*\*?\*?\$?([\d,]+)/i);

  return {
    hourly: hourlyMatch ? `$${hourlyMatch[1].replace(/,/g, '')}` : defaults.hourly,
    daily: dailyMatch ? `$${dailyMatch[1]}` : defaults.daily,
    weekly: weeklyMatch ? `$${weeklyMatch[1]}` : defaults.weekly
  };
}

// Extract clinical details
function extractClinicalDetails(playbookContent: string): {
  callStatus: string;
  schedule: string;
  facilityType: string;
  credentialingDays: string;
} {
  const defaults = {
    callStatus: "zero call",
    schedule: "M-F 8-5",
    facilityType: "non-trauma",
    credentialingDays: "40"
  };

  if (!playbookContent) return defaults;

  let callStatus = defaults.callStatus;
  if (playbookContent.toLowerCase().includes("no call") || 
      playbookContent.toLowerCase().includes("zero call")) {
    callStatus = "zero call";
  }

  const credMatch = playbookContent.match(/(\d+)[\s-]*day/i);
  const credentialingDays = credMatch ? credMatch[1] : defaults.credentialingDays;

  return { ...defaults, callStatus, credentialingDays };
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
    const { candidate_id, job_id, template_style = 'ca_license', personalization_hook, custom_context, playbook_content } = body;

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

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Build system prompt
    const systemPrompt = `${SMS_PERSONA}

PLAYBOOK DATA (USE EXACTLY):
- Rate: ${rates.hourly}/hr
- Daily: ${rates.daily}
- Weekly: ${rates.weekly}
- Call: ${clinical.callStatus}
- Schedule: ${clinical.schedule}
- Facility: ${clinical.facilityType}
- Credentialing: ${clinical.credentialingDays} days

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
        ? `Your ${job.state} license = ${clinical.credentialingDays}-day start.`
        : `${licenseCount} licenses = flexibility.`;
      
      const templates = {
        ca_license: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${job.facility_name} (${location}): ${rates.hourly}/hr, ${clinical.callStatus}. ${licenseHook} 15 min to discuss fit?`, 
            style: 'license_priority' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr ${candidate.specialty} locums, ${clinical.facilityType} case mix. ${job.city}, ${job.state}. ${licenseHook} Quick call on scope?`, 
            style: 'clinical_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums IR at ${job.facility_name}: ${rates.hourly}/hr, ${clinical.schedule}, ${clinical.callStatus}. ${licenseHook} Worth 15 min?`, 
            style: 'schedule_focus' 
          }
        ],
        no_call: [
          { 
            sms: `Dr. ${candidate.last_name} - ${candidate.specialty} locums with ZERO call. ${rates.hourly}/hr at ${job.facility_name}, ${location}. ${clinical.schedule}, done at 5. ${licenseHook} 15 min?`, 
            style: 'no_call_emphasis' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - If call is burning you out: ${job.facility_name} locums, ${rates.hourly}/hr, zero call. ${clinical.facilityType}, ${location}. Worth discussing?`, 
            style: 'burnout_relief' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${rates.hourly}/hr, NO CALL. ${job.city} (${clinical.facilityType}). ${clinical.schedule}. ${licenseHook} Quick call?`, 
            style: 'direct' 
          }
        ],
        compensation: [
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr locums ${candidate.specialty} at ${job.facility_name}, ${location}. ${rates.daily}/day, ${clinical.callStatus}. ${licenseHook} 15 min to discuss?`, 
            style: 'rate_focused' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${rates.hourly}/hr (${rates.weekly}/week). ${job.city}, ${clinical.callStatus}, ${clinical.facilityType}. ${licenseHook} Worth a call?`, 
            style: 'weekly_rate' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${rates.hourly}/hr ${candidate.specialty} locums. ${job.facility_name}, ${clinical.callStatus}. Routine case mix, sustainable pace. 15 min on clinical fit?`, 
            style: 'sustainable' 
          }
        ],
        non_trauma: [
          { 
            sms: `Dr. ${candidate.last_name} - ${clinical.facilityType} ${candidate.specialty} locums: ${rates.hourly}/hr, ${clinical.callStatus}. ${job.facility_name}, ${location}. Sustainable pace. ${licenseHook} 15 min?`, 
            style: 'non_trauma_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${clinical.facilityType} center: ${rates.hourly}/hr, routine case mix. ${job.city}, ${clinical.callStatus}. Quick call on scope?`, 
            style: 'routine_case' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - No trauma chaos: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. ${clinical.callStatus}, ${clinical.schedule}. ${licenseHook} 15 min?`, 
            style: 'anti_trauma' 
          }
        ],
        location: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} in ${job.city} (LA County): ${rates.hourly}/hr, ${clinical.callStatus}. ${job.facility_name}, ${clinical.facilityType}. ${licenseHook} 15 min?`, 
            style: 'location_first' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${job.facility_name} (${location}): ${rates.hourly}/hr ${candidate.specialty} locums, ${clinical.callStatus}. ${licenseHook} Quick call on clinical fit?`, 
            style: 'facility_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${location} ${candidate.specialty} locums: ${rates.hourly}/hr at ${job.facility_name}. ${clinical.callStatus}, ${clinical.schedule}. Worth 15 min to discuss?`, 
            style: 'metro_focus' 
          }
        ],
        board_eligible: [
          { 
            sms: `Dr. ${candidate.last_name} - Board Eligible accepted: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. ${clinical.callStatus}, ${location}. Start earning now. 15 min?`, 
            style: 'be_accepted' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Recent fellowship? ${job.facility_name} takes Board Eligible: ${rates.hourly}/hr, ${clinical.callStatus}. ${location}. Earn while prepping boards. Quick call?`, 
            style: 'new_grad' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Don't wait for boards: ${rates.hourly}/hr ${candidate.specialty} locums at ${job.facility_name}. BE within 5 years OK. ${clinical.callStatus}. 15 min?`, 
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
