import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuggestRepliesRequest {
  conversation_id: string;
  last_message: string;
  candidate_id?: string;
  campaign_id?: string;
  channel: "sms" | "call";
}

interface SuggestionResult {
  id: string;
  text: string;
  intent: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { conversation_id, last_message, candidate_id, campaign_id, channel } = await req.json() as SuggestRepliesRequest;

    if (!last_message?.trim()) {
      return new Response(
        JSON.stringify({ suggestions: [], error: "No message to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch context data in parallel
    const [candidateResult, campaignResult, conversationHistory] = await Promise.all([
      candidate_id
        ? supabase
            .from("candidates")
            .select("first_name, last_name, specialty, city, state, licenses, personal_email, personal_mobile")
            .eq("id", candidate_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      campaign_id
        ? supabase
            .from("campaigns")
            .select("name, playbook_data, job_id")
            .eq("id", campaign_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("sms_messages")
        .select("direction, body, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const candidate = candidateResult.data;
    const campaign = campaignResult.data;
    const recentMessages = conversationHistory.data || [];

    // Build context for AI
    let jobContext = "";
    if (campaign?.job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("title, specialty, state, city, facility_name, pay_rate, shift_type")
        .eq("id", campaign.job_id)
        .maybeSingle();

      if (job) {
        jobContext = `
JOB DETAILS:
- Title: ${job.title || "N/A"}
- Specialty: ${job.specialty || "N/A"}
- Location: ${job.city || ""}, ${job.state || ""}
- Facility: ${job.facility_name || "N/A"}
- Pay Rate: ${job.pay_rate ? `$${job.pay_rate}/hr` : "N/A"}
- Shift: ${job.shift_type || "N/A"}`;
      }
    }

    // Parse playbook data if available
    let playbookContext = "";
    if (campaign?.playbook_data) {
      const playbook = typeof campaign.playbook_data === "string" 
        ? JSON.parse(campaign.playbook_data) 
        : campaign.playbook_data;
      
      if (playbook?.compensation?.rate) {
        playbookContext += `\nPay Rate: $${playbook.compensation.rate}/hr`;
      }
      if (playbook?.clinical?.callBurden) {
        playbookContext += `\nCall Burden: ${playbook.clinical.callBurden}`;
      }
      if (playbook?.strategy?.sellingPoints?.length) {
        playbookContext += `\nSelling Points: ${playbook.strategy.sellingPoints.slice(0, 3).join(", ")}`;
      }
    }

    const candidateContext = candidate
      ? `
CANDIDATE:
- Name: Dr. ${candidate.last_name || "Unknown"}
- Specialty: ${candidate.specialty || "N/A"}
- Location: ${candidate.city || ""}, ${candidate.state || ""}
- Licenses: ${candidate.licenses?.length || 0} states`
      : "";

    const conversationContext = recentMessages
      .reverse()
      .map((m: { direction: string; body: string }) => `${m.direction === "inbound" ? "Candidate" : "Recruiter"}: ${m.body}`)
      .join("\n");

    const systemPrompt = `You are an AI assistant helping medical recruiters craft professional SMS replies to physician candidates.

CONTEXT:
${candidateContext}
${jobContext}
${playbookContext ? `\nPLAYBOOK INFO:${playbookContext}` : ""}

RECENT CONVERSATION:
${conversationContext || "No previous messages"}

LATEST INBOUND MESSAGE:
"${last_message}"

RULES:
1. Generate exactly 3 reply suggestions
2. Each reply must be under 160 characters (SMS limit)
3. Use professional, clinical consultant tone (not salesy)
4. Address the candidate as "Dr. [LastName]" if known
5. Be direct and action-oriented
6. Include specific details from context when relevant (rates, location, etc.)
7. Each suggestion should have a different intent/approach

INTENTS TO CONSIDER:
- answer_question: Directly answer their question with facts
- schedule_call: Propose a quick call to discuss
- confirm_interest: Confirm their interest and next steps
- provide_info: Share specific job/rate details
- re_engage: Warm follow-up if they seem hesitant
- address_concern: Handle objections professionally

Respond with a JSON array of exactly 3 suggestions in this format:
[
  {"id": "1", "text": "reply text here", "intent": "intent_name", "confidence": 0.9},
  {"id": "2", "text": "reply text here", "intent": "intent_name", "confidence": 0.8},
  {"id": "3", "text": "reply text here", "intent": "intent_name", "confidence": 0.7}
]`;

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
          { role: "user", content: `Generate 3 professional SMS reply suggestions for this message: "${last_message}"` },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", suggestions: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits.", suggestions: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let suggestions: SuggestionResult[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback suggestions
      suggestions = [
        { id: "1", text: "Thanks for reaching out! When's a good time for a quick call?", intent: "schedule_call", confidence: 0.7 },
        { id: "2", text: "Happy to share more details. What questions do you have?", intent: "provide_info", confidence: 0.6 },
        { id: "3", text: "Let me check on that and get back to you shortly.", intent: "answer_question", confidence: 0.5 },
      ];
    }

    // Detect sentiment from last message
    let sentiment = "neutral";
    const lowerMessage = last_message.toLowerCase();
    if (lowerMessage.includes("interested") || lowerMessage.includes("yes") || lowerMessage.includes("tell me more")) {
      sentiment = "interested";
    } else if (lowerMessage.includes("stop") || lowerMessage.includes("unsubscribe") || lowerMessage.includes("remove")) {
      sentiment = "opt_out";
    } else if (lowerMessage.includes("not interested") || lowerMessage.includes("no thanks")) {
      sentiment = "not_interested";
    } else if (lowerMessage.includes("?") || lowerMessage.includes("how") || lowerMessage.includes("what")) {
      sentiment = "question";
    }

    return new Response(
      JSON.stringify({ 
        suggestions: suggestions.slice(0, 3),
        sentiment,
        analyzed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("suggest-replies error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        suggestions: [] 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
