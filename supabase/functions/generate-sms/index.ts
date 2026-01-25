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
  playbook_data?: StructuredPlaybookCache; // Allow passing playbook directly
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

    const body: SMSRequest = await req.json();
    const { candidate_id, job_id, campaign_id, template_style = 'ca_license', personalization_hook, custom_context, playbook_data } = body;

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
      throw new Error("NO PLAYBOOK FOUND - cannot generate SMS without playbook data. Please sync a playbook first.");
    }
    
    if (!playbook.compensation?.hourly && !playbook.compensation?.salary_range) {
      throw new Error("NO COMPENSATION FOUND - cannot generate SMS without verified hourly rate or salary range. Please ensure playbook contains compensation information.");
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

    const licenseCount = candidate.licenses?.length || 0;
    const hasJobStateLicense = job.state && candidate.licenses?.includes(job.state);

    // Extract values from structured playbook with safe defaults
    const hourlyRate = playbook.compensation.hourly || playbook.compensation.salary_range || "Rate TBD";
    const dailyRate = playbook.compensation.daily || "";
    const weeklyRate = playbook.compensation.weekly || "";
    
    const callStatus = playbook.clinical?.call_status || "flexible schedule";
    const schedule = playbook.clinical?.schedule_days || "weekday hours";
    const facilityType = playbook.position?.facility_type || "hospital";
    const credDays = playbook.credentialing?.days_to_credential ? `${playbook.credentialing.days_to_credential}` : "expedited";
    
    const facilityName = playbook.position?.facility_name || job.facility_name;
    const locationCity = playbook.position?.location_city || job.city;
    const locationState = playbook.position?.location_state || job.state;
    const contractType = playbook.position?.contract_type || "locums";
    
    // Positioning guidance
    const sellingPoints = playbook.positioning?.selling_points || "";
    const messagingTone = playbook.positioning?.messaging_tone || "";
    const differentiators = playbook.positioning?.differentiators || "";

    // Build system prompt with structured data
    const systemPrompt = `${SMS_PERSONA}

=== COMPENSATION (USE EXACTLY - NEVER CALCULATE) ===
- Rate: ${hourlyRate}/hr
${dailyRate ? `- Daily: ${dailyRate}` : ''}
${weeklyRate ? `- Weekly: ${weeklyRate}` : ''}

=== CLINICAL ===
- Call: ${callStatus}
- Schedule: ${schedule}
- Facility: ${facilityType}
${credDays ? `- Credentialing: ${credDays} days` : ''}

=== POSITION ===
- Facility: ${facilityName}
- Location: ${locationCity}, ${locationState}
- Contract: ${contractType}

=== POSITIONING GUIDANCE ===
${sellingPoints ? `Lead with: ${sellingPoints.substring(0, 200)}` : ''}
${messagingTone ? `Tone: ${messagingTone.substring(0, 100)}` : ''}
${differentiators ? `Key differentiator: ${differentiators.substring(0, 100)}` : ''}

=== CANDIDATE ===
- Name: Dr. ${candidate.last_name}
- Specialty: ${candidate.specialty}
- Location: ${candidate.city || ''}, ${candidate.state}
- Licenses: ${licenseCount} states${hasJobStateLicense ? ` (has ${locationState})` : ''}

${hook ? `PERSONALIZATION HOOK: ${hook}` : ''}
${custom_context ? `CONTEXT: ${custom_context}` : ''}

=== CRITICAL INSTRUCTIONS ===
1. Use the compensation values EXACTLY as shown - if rate is ${hourlyRate}, output ${hourlyRate}
2. Follow the messaging tone/selling points guidance
3. Keep under 300 characters
4. Include "locums" signal`;

    // Template-based SMS generation (fallback)
    const generateFallbackSMS = () => {
      const location = locationCity;
      const licenseHook = hasJobStateLicense 
        ? `Your ${locationState} license = ${credDays}-day start.`
        : `${licenseCount} licenses = flexibility.`;
      
      const templates = {
        ca_license: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${facilityName} (${location}): ${hourlyRate}/hr, ${callStatus}. ${licenseHook} 15 min to discuss fit?`, 
            style: 'license_priority' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${hourlyRate}/hr ${candidate.specialty} locums, ${facilityType} case mix. ${locationCity}, ${locationState}. ${licenseHook} Quick call on scope?`, 
            style: 'clinical_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${facilityName}: ${hourlyRate}/hr, ${schedule}, ${callStatus}. ${licenseHook} Worth 15 min?`, 
            style: 'schedule_focus' 
          }
        ],
        no_call: [
          { 
            sms: `Dr. ${candidate.last_name} - ${candidate.specialty} locums with ZERO call. ${hourlyRate}/hr at ${facilityName}, ${location}. ${schedule}. ${licenseHook} 15 min?`, 
            style: 'no_call_emphasis' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - If call is burning you out: ${facilityName} locums, ${hourlyRate}/hr, zero call. ${facilityType}, ${location}. Worth discussing?`, 
            style: 'burnout_relief' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${hourlyRate}/hr, NO CALL. ${locationCity} (${facilityType}). ${schedule}. ${licenseHook} Quick call?`, 
            style: 'direct' 
          }
        ],
        compensation: [
          { 
            sms: `Dr. ${candidate.last_name} - ${hourlyRate}/hr locums ${candidate.specialty} at ${facilityName}, ${location}. ${dailyRate ? `${dailyRate}/day, ` : ''}${callStatus}. ${licenseHook} 15 min to discuss?`, 
            style: 'rate_focused' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty}: ${hourlyRate}/hr${weeklyRate ? ` (${weeklyRate}/week)` : ''}. ${locationCity}, ${callStatus}, ${facilityType}. ${licenseHook} Worth a call?`, 
            style: 'weekly_rate' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${hourlyRate}/hr ${candidate.specialty} locums. ${facilityName}, ${callStatus}. Routine case mix, sustainable pace. 15 min on clinical fit?`, 
            style: 'sustainable' 
          }
        ],
        non_trauma: [
          { 
            sms: `Dr. ${candidate.last_name} - ${facilityType} ${candidate.specialty} locums: ${hourlyRate}/hr, ${callStatus}. ${facilityName}, ${location}. Sustainable pace. ${licenseHook} 15 min?`, 
            style: 'non_trauma_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} at ${facilityType}: ${hourlyRate}/hr, routine case mix. ${locationCity}, ${callStatus}. Quick call on scope?`, 
            style: 'routine_case' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - No trauma chaos: ${hourlyRate}/hr ${candidate.specialty} locums at ${facilityName}. ${callStatus}, ${schedule}. ${licenseHook} 15 min?`, 
            style: 'anti_trauma' 
          }
        ],
        location: [
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} in ${locationCity}: ${hourlyRate}/hr, ${callStatus}. ${facilityName}, ${facilityType}. ${licenseHook} 15 min?`, 
            style: 'location_first' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${facilityName} (${location}): ${hourlyRate}/hr ${candidate.specialty} locums, ${callStatus}. ${licenseHook} Quick call on clinical fit?`, 
            style: 'facility_focus' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${candidate.specialty} locums near ${locationCity}: ${hourlyRate}/hr, ${facilityType}, ${callStatus}. ${licenseHook} 15 min to discuss?`, 
            style: 'metro_focus' 
          }
        ],
        board_eligible: [
          { 
            sms: `Dr. ${candidate.last_name} - Board-eligible welcome: ${hourlyRate}/hr ${candidate.specialty} locums at ${facilityName}, ${location}. ${callStatus}. 15 min to discuss?`, 
            style: 'board_eligible' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - Locums ${candidate.specialty} (BC/BE): ${hourlyRate}/hr, ${facilityType}, ${locationCity}. ${callStatus}. ${licenseHook} Quick call?`, 
            style: 'be_welcome' 
          },
          { 
            sms: `Dr. ${candidate.last_name} - ${candidate.specialty} locums for BC/BE: ${hourlyRate}/hr at ${facilityName}. ${schedule}, ${callStatus}. Worth discussing?`, 
            style: 'inclusive' 
          }
        ],
      };

      const styleTemplates = templates[template_style] || templates.ca_license;
      
      // Truncate each SMS to 300 chars
      return styleTemplates.map(t => ({
        sms: t.sms.substring(0, 300),
        style: t.style
      }));
    };

    // Try AI generation, fall back to templates
    let smsOptions: { sms: string; style: string }[];
    let usedFallback = false;

    try {
      console.log("Calling Lovable AI Gateway for SMS generation...");
      
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
              content: `Generate 3 SMS options for Dr. ${candidate.last_name}. Return ONLY valid JSON array: [{"sms": "message under 300 chars", "style": "style_name"}]. No markdown.`
            }
          ],
          temperature: 0.8,
          max_tokens: 800,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        
        if (aiResponse.status === 402) {
          console.log("Credits exhausted - using fallback templates");
          smsOptions = generateFallbackSMS();
          usedFallback = true;
        } else {
          throw new Error(`AI Gateway error: ${aiResponse.status}`);
        }
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        console.log("AI Response received, length:", content.length);
        
        // Parse JSON response
        let parsed: { sms: string; style: string }[] | null = null;
        try {
          const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(cleanContent);
        } catch {
          console.log("Failed to parse AI response as JSON");
        }
        
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sms) {
          // Truncate each to 300 chars
          smsOptions = parsed.map(opt => ({
            sms: opt.sms.substring(0, 300),
            style: opt.style || 'ai_generated'
          }));
        } else {
          console.log("Invalid AI response format, using fallback");
          smsOptions = generateFallbackSMS();
          usedFallback = true;
        }
      }
    } catch (aiError) {
      console.error("AI generation failed:", aiError);
      smsOptions = generateFallbackSMS();
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
        sms_options: smsOptions,
        template_style,
        // Include rate metadata for verification
        rates_used: {
          hourly: playbook.compensation.hourly,
          daily: playbook.compensation.daily,
          weekly: playbook.compensation.weekly,
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
        },
        personalization_used: !!hook,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SMS generation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
