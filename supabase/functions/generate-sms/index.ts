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

interface SMSRequest {
  candidate_id: string;
  job_id: string;
  campaign_id?: string;
  template_style?: 'ca_license' | 'no_call' | 'compensation' | 'location' | 'board_eligible' | 'non_trauma';
  personalization_hook?: string;
  custom_context?: string;
  playbook_data?: StructuredPlaybookCache; // Allow passing playbook directly
  signature?: UserSignature; // User signature for SMS sign-off
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
    const { candidate_id, job_id, campaign_id, template_style = 'ca_license', personalization_hook, custom_context, playbook_data, signature, connection } = body;
    
    // Log connection status for debugging
    console.log(`📱 SMS generation for candidate ${candidate_id}`);
    if (connection) {
      console.log(`   ✅ Using connection P${connection.priority}: "${connection.smsLine}"`);
    } else {
      console.log(`   ⚠️ No connection received - will use fallback template`);
    }
    
    // Build SMS signature suffix (use provided or default)
    // Fix: Use first_name from signature, not generic "Locums"
    const smsSignerName = signature?.first_name && signature.first_name.trim() 
      ? signature.first_name.trim() 
      : 'Team';
    const smsSuffix = ` - ${smsSignerName}@Locums.one`;
    console.log("Using SMS signature:", smsSuffix, "from first_name:", signature?.first_name);

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
    const credDays = playbook.credentialing?.days_to_credential ? `${playbook.credentialing.days_to_credential}` : "expedited";
    
    const facilityName = playbook.position?.facility_name || job.facility_name;
    const facilityType = playbook.position?.facility_type || null;
    const traumaLevel = playbook.position?.trauma_level || null;
    const locationCity = playbook.position?.location_city || job.city;
    const locationState = playbook.position?.location_state || job.state;
    const locationMetro = playbook.position?.location_metro || locationCity;
    const contractType = playbook.position?.contract_type || "locums";
    
    // Derive facility description from trauma_level
    const getFacilityDescription = (): string => {
      if (traumaLevel === "None") return facilityType || "Non-trauma hospital";
      if (traumaLevel && traumaLevel !== "None") return facilityType || `${traumaLevel} Trauma Center`;
      return facilityType || "hospital";
    };
    const facilityDescription = getFacilityDescription();
    
    // Positioning guidance
    const sellingPoints = playbook.positioning?.selling_points || "";
    const messagingTone = playbook.positioning?.messaging_tone || "";
    const differentiators = playbook.positioning?.differentiators || "";

    // Build system prompt with structured data
    // CRITICAL: Accuracy rules at TOP so AI sees them first
    const systemPrompt = `=== FACILITY DATA (USE EXACTLY AS PROVIDED - NEVER INVENT) ===
- Facility Name: ${facilityName}
- Facility Type: ${facilityDescription}
- Trauma Level: ${traumaLevel || "Not specified - DO NOT ASSUME ANY TRAUMA LEVEL"}
- Location: ${locationCity}, ${locationState}
- Metro Area: ${locationMetro}

CRITICAL: When describing the facility, use the FACILITY DATA fields exactly.
- If Trauma Level is "None" or "Not specified", NEVER mention trauma
- Describe as "${facilityDescription}" - not "Level I trauma" or similar
- Do not assume characteristics from location (LA metro ≠ trauma center)

=== ACCURACY RULES ===

1. COMPENSATION: "${hourlyRate}" exactly - never calculate or modify

2. CALL STATUS: "${callStatus}" is a key differentiator

3. NO HALLUCINATION: Only include facts from this data

=== END CRITICAL RULES ===

${SMS_PERSONA}

=== COMPENSATION (USE EXACTLY) ===
- Rate: ${hourlyRate}/hr
${dailyRate ? `- Daily: ${dailyRate}` : ''}
${weeklyRate ? `- Weekly: ${weeklyRate}` : ''}

=== CLINICAL ===
- Call: ${callStatus}
- Schedule: ${schedule}
- Facility: ${facilityDescription}
${credDays ? `- Credentialing: ${credDays} days` : ''}

=== POSITION ===
- Position Title: ${playbook.position?.title || job.job_name || `${candidate.specialty} ${contractType}`}
- Contract Type: ${contractType}

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

=== CONNECTION-FIRST SMS STRUCTURE ===
${connection ? `
CONNECTION FOUND (Priority ${connection.priority}):
- smsLine to use: "${connection.smsLine}"
- Full line: "${connection.line}"

Use "${connection.smsLine}" as the personalization hook in the SMS. This connection MUST appear.
` : `
No direct connection found. Use the license count or call status as the hook.
`}

IMPORTANT: End EVERY SMS with "${smsSuffix}" as the signature.
Keep SMS under 300 characters INCLUDING the signature. Include "locums" signal.`;

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
      
      // Append signature suffix and truncate each SMS to 300 chars
      return styleTemplates.map(t => {
        // Calculate available space for message (300 - signature length)
        const maxMsgLength = 300 - smsSuffix.length;
        const truncatedMsg = t.sms.substring(0, maxMsgLength);
        return {
          sms: truncatedMsg + smsSuffix,
          style: t.style
        };
      });
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
          // Ensure signature is appended (AI may not have included it correctly)
          smsOptions = parsed.map(opt => {
            let sms = opt.sms;
            // Only append signature if not already present
            if (!sms.includes('@Locums.one')) {
              const maxMsgLength = 300 - smsSuffix.length;
              sms = sms.substring(0, maxMsgLength) + smsSuffix;
            }
            return {
              sms: sms.substring(0, 300),
              style: opt.style || 'ai_generated'
            };
          });
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
