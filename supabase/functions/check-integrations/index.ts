import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { checkEmail, checkSms, checkVoice, senderEmail } = body;

    const results: Record<string, { connected: boolean; error?: string; phoneNumber?: string }> = {};

    // Check Instantly (Email)
    if (checkEmail) {
      const instantlyKey = Deno.env.get("INSTANTLY_API_KEY");
      if (!instantlyKey) {
        results.instantly = { connected: false, error: "API key not configured" };
      } else {
        try {
          // Instantly v2 API - accounts endpoint
          const res = await fetch("https://api.instantly.ai/api/v2/accounts?limit=10", {
            headers: { Authorization: `Bearer ${instantlyKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            // v2 returns { items: [...] } format
            const accounts = data.items || data.accounts || [];
            results.instantly = { 
              connected: true,
              phoneNumber: senderEmail || (accounts[0]?.email) || "Email ready"
            };
          } else {
            const errorText = await res.text();
            console.error("Instantly API error:", res.status, errorText);
            results.instantly = { connected: false, error: "API authentication failed" };
          }
        } catch (err) {
          console.error("Instantly connection error:", err);
          results.instantly = { connected: false, error: "Connection failed" };
        }
      }
    }

    // Check Twilio (SMS)
    if (checkSms) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioSid || !twilioToken) {
        results.twilio = { connected: false, error: "Credentials not configured" };
      } else {
        try {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            },
          });
          if (res.ok) {
            results.twilio = { 
              connected: true, 
              phoneNumber: twilioPhone || "SMS ready" 
            };
          } else {
            results.twilio = { connected: false, error: "API authentication failed" };
          }
        } catch (err) {
          results.twilio = { connected: false, error: "Connection failed" };
        }
      }
    }

    // Check Retell (Voice)
    if (checkVoice) {
      const retellKey = Deno.env.get("RETELL_API_KEY");
      const retellAgentId = Deno.env.get("RETELL_AGENT_ID");

      if (!retellKey) {
        results.retell = { connected: false, error: "API key not configured" };
      } else {
        try {
          const res = await fetch("https://api.retellai.com/list-agents", {
            headers: { 
              Authorization: `Bearer ${retellKey}`,
              "Content-Type": "application/json"
            },
          });
          if (res.ok) {
            results.retell = { 
              connected: true,
              phoneNumber: retellAgentId ? "ARIA ready" : "Agent configured"
            };
          } else {
            results.retell = { connected: false, error: "API authentication failed" };
          }
        } catch (err) {
          results.retell = { connected: false, error: "Connection failed" };
        }
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Integration check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
