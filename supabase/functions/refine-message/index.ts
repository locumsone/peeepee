import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefineRequest {
  message_type: "email" | "sms";
  current_subject?: string;
  current_body: string;
  refinement_prompt: string;
  candidate_context: {
    name: string;
    specialty?: string;
    licenses?: string[];
  };
  job_context: {
    rate: string;
    location: string;
    call_status?: string;
    facility_name?: string;
  };
  playbook_data?: {
    compensation?: { hourly?: string | null };
    clinical?: { call_status?: string | null };
    position?: { facility_name?: string | null };
  };
}

interface RefineResponse {
  refined_subject?: string;
  refined_body: string;
  changes_made: string[];
  word_count: number;
}

// Quick action presets
const QUICK_ACTIONS: Record<string, string> = {
  shorten: "Reduce to 100-120 words. Keep only essential clinical details and CTA. Remove any filler or redundant phrases.",
  more_clinical: "Add specific procedure names, volume details, and clinical scope from the playbook. Make it more medically precise.",
  less_salesy: "Remove any recruiter-speak, exclamation points, or salesy language. Use clinical consultant tone. Words to remove: exciting, amazing, elite, opportunity, fantastic.",
  emphasize_rate: "Move compensation to the first sentence. Make the rate the lead. Format: '$X/hr [Specialty] locums...'",
  emphasize_location: "Lead with geographic benefits and accessibility. Mention commute advantages, local perks, or regional benefits first.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body: RefineRequest = await req.json();
    const { 
      message_type, 
      current_subject, 
      current_body, 
      refinement_prompt,
      candidate_context,
      job_context,
      playbook_data
    } = body;

    if (!current_body || !refinement_prompt) {
      throw new Error("current_body and refinement_prompt are required");
    }

    // Check if it's a quick action
    const quickActionKey = refinement_prompt.toLowerCase().replace(/\s+/g, '_');
    const actualPrompt = QUICK_ACTIONS[quickActionKey] || refinement_prompt;

    const currentWordCount = current_body.split(/\s+/).length;
    const hourlyRate = playbook_data?.compensation?.hourly || job_context.rate || '$X';
    const callStatus = playbook_data?.clinical?.call_status || job_context.call_status || '';
    const facilityName = playbook_data?.position?.facility_name || job_context.facility_name || '';

    const systemPrompt = `You are an AI message editor for medical recruiter outreach. 
You refine messages to be more effective while maintaining accuracy.

RULES:
- Never invent or change compensation figures - use EXACTLY: ${hourlyRate}/hr
- Never invent clinical details not in the original message
- Maintain "Dr. [Last Name]" format
- Keep the clinical consultant tone (not recruiter-speak)
- Forbidden words: exciting, amazing, elite, opportunity, fantastic, incredible
- No exclamation points
- SMS must stay under 300 characters
- Permission-based CTA only (e.g., "Worth 15 min?" not "Let's schedule a call!")

CONTEXT:
- Candidate: ${candidate_context.name}, ${candidate_context.specialty || 'Physician'}
- Location: ${job_context.location}
- Rate: ${hourlyRate}/hr
- Call Status: ${callStatus}
- Facility: ${facilityName}
- Current word count: ${currentWordCount}`;

    const userPrompt = `REFINEMENT REQUEST: ${actualPrompt}

CURRENT ${message_type.toUpperCase()}:
${current_subject ? `Subject: ${current_subject}\n` : ''}
${current_body}

---

Apply the refinement. Return ONLY valid JSON:
{
  ${message_type === 'email' ? '"refined_subject": "...",\n  ' : ''}"refined_body": "...",
  "changes_made": ["change 1", "change 2"],
  "word_count": X
}`;

    console.log(`Refining ${message_type} with prompt: "${refinement_prompt}"`);

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
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 402) {
        // Credits exhausted - return original with note
        return new Response(
          JSON.stringify({
            success: true,
            refined_subject: current_subject,
            refined_body: current_body,
            changes_made: ["No changes - AI credits exhausted"],
            word_count: currentWordCount,
            credits_exhausted: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI refinement response received, length:", content.length);

    // Parse JSON response
    let result: RefineResponse;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch {
      // Try to extract with regex
      const bodyMatch = content.match(/["']?refined_body["']?\s*:\s*["']([\s\S]+?)["'](?:\s*,|\s*})/i);
      const changesMatch = content.match(/["']?changes_made["']?\s*:\s*\[([\s\S]+?)\]/i);
      
      if (bodyMatch) {
        result = {
          refined_body: bodyMatch[1].replace(/\\n/g, '\n'),
          changes_made: changesMatch ? 
            changesMatch[1].split(',').map((c: string) => c.trim().replace(/["']/g, '')) : 
            ["Content refined"],
          word_count: bodyMatch[1].split(/\s+/).length,
        };
        
        if (message_type === 'email') {
          const subjectMatch = content.match(/["']?refined_subject["']?\s*:\s*["']([^"']+)["']/i);
          if (subjectMatch) {
            result.refined_subject = subjectMatch[1];
          }
        }
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    // Validate SMS length
    if (message_type === 'sms' && result.refined_body.length > 300) {
      console.warn(`SMS too long (${result.refined_body.length} chars), truncating`);
      result.refined_body = result.refined_body.substring(0, 297) + '...';
      result.changes_made.push('Truncated to 300 chars');
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        original_word_count: currentWordCount,
        quick_action_used: QUICK_ACTIONS[quickActionKey] ? quickActionKey : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Message refinement error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
