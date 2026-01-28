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
    const instantlyKey = Deno.env.get("INSTANTLY_API_KEY");
    
    if (!instantlyKey) {
      return new Response(
        JSON.stringify({ error: "INSTANTLY_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching accounts from Instantly v2 API...");

    // Fetch accounts from Instantly v2 API
    const res = await fetch("https://api.instantly.ai/api/v2/accounts?limit=100", {
      headers: { 
        Authorization: `Bearer ${instantlyKey}`,
        "Content-Type": "application/json"
      },
    });

    const responseText = await res.text();
    console.log("Instantly API response status:", res.status);
    console.log("Instantly API response:", responseText);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch from Instantly API", 
          status: res.status,
          details: responseText 
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = JSON.parse(responseText);
    
    // v2 API returns { items: [...] } format
    const accounts = data.items || data.accounts || [];
    
    // Extract email addresses
    const emailAccounts = accounts.map((account: any) => ({
      email: account.email,
      status: account.status,
      warmup_status: account.warmup_status,
      daily_limit: account.daily_limit,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: emailAccounts.length,
        accounts: emailAccounts 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Instantly accounts:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
