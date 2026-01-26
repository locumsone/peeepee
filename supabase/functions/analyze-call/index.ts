import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_id, transcript } = await req.json();
    
    if (!transcript || !call_id) {
      return new Response(
        JSON.stringify({ error: "call_id and transcript are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing call:", call_id);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a recruiting call analyst specializing in healthcare staffing. Analyze call transcripts between recruiters and medical professionals (physicians, nurses, etc.) to extract actionable insights.

Focus on:
1. Candidate sentiment toward the opportunity
2. Key discussion points and interests
3. Any objections, concerns, or barriers mentioned
4. Next steps or follow-ups discussed
5. Overall interest level
6. Best recommended follow-up action

Be concise and actionable in your analysis.`
          },
          { 
            role: "user", 
            content: `Analyze this recruiting call transcript:\n\n${transcript}` 
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_call",
            description: "Extract structured insights from a recruiting call transcript",
            parameters: {
              type: "object",
              properties: {
                sentiment: { 
                  type: "string", 
                  enum: ["positive", "neutral", "negative"],
                  description: "Overall candidate sentiment toward the opportunity"
                },
                key_points: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "3-5 key discussion points or interests mentioned"
                },
                objections: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Any objections, concerns, or barriers raised"
                },
                next_steps: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Follow-ups or next steps discussed"
                },
                interest_level: { 
                  type: "number",
                  description: "Interest level from 1 (not interested) to 5 (very interested)"
                },
                recommended_action: { 
                  type: "string",
                  description: "Specific recommended follow-up action for the recruiter"
                },
                summary: {
                  type: "string",
                  description: "1-2 sentence summary of the call outcome"
                }
              },
              required: ["sentiment", "key_points", "objections", "next_steps", "interest_level", "recommended_action", "summary"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_call" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const result = await aiResponse.json();
    console.log("AI response received");

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response structure");
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    console.log("Analysis parsed:", analysis);

    // Update the call log with AI analysis
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabase
      .from("ai_call_logs")
      .update({
        ai_analysis: analysis,
        sentiment: analysis.sentiment,
      })
      .eq("id", call_id);

    if (updateError) {
      console.error("Failed to update call log:", updateError);
      // Still return the analysis even if DB update fails
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
