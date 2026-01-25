import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichmentRequest {
  candidate_id: string;
  first_name: string;
  last_name: string;
  city?: string;
  state?: string;
  specialty?: string;
  job_id?: string;
}

interface EnrichmentResult {
  success: boolean;
  source: "PDL" | "Whitepages" | "none";
  personal_email: string | null;
  personal_mobile: string | null;
  confidence: "high" | "medium" | "low";
  cost: number;
}

// PeopleDataLabs enrichment - cheaper, try first
async function tryPDLEnrichment(
  apiKey: string,
  firstName: string,
  lastName: string,
  city?: string,
  state?: string
): Promise<{ email: string | null; phone: string | null; confidence: string } | null> {
  try {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      pretty: "true",
    });
    
    if (city && state) {
      params.append("location", `${city}, ${state}`);
    } else if (state) {
      params.append("region", state);
    }

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log("PDL API returned non-200:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const person = data.data;
      const email = person.work_email || person.personal_emails?.[0] || null;
      const phone = person.mobile_phone || person.phone_numbers?.[0] || null;
      
      if (email || phone) {
        return {
          email,
          phone,
          confidence: data.likelihood >= 8 ? "high" : data.likelihood >= 5 ? "medium" : "low",
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("PDL enrichment error:", error);
    return null;
  }
}

// Whitepages Pro enrichment - more expensive, higher match rate
async function tryWhitepagesEnrichment(
  apiKey: string,
  firstName: string,
  lastName: string,
  city?: string,
  state?: string
): Promise<{ email: string | null; phone: string | null; confidence: string } | null> {
  try {
    const params = new URLSearchParams({
      "api_key": apiKey,
      "firstname": firstName,
      "lastname": lastName,
    });
    
    if (city) params.append("address.city", city);
    if (state) params.append("address.state_code", state);

    const response = await fetch(`https://proapi.whitepages.com/3.3/person?${params}`);

    if (!response.ok) {
      console.log("Whitepages API returned non-200:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.person && data.person.length > 0) {
      const person = data.person[0];
      
      // Extract phone
      let phone: string | null = null;
      if (person.phones && person.phones.length > 0) {
        const mobilePhone = person.phones.find((p: any) => p.line_type === "Mobile");
        phone = mobilePhone?.phone_number || person.phones[0]?.phone_number || null;
      }
      
      // Extract email
      let email: string | null = null;
      if (person.emails && person.emails.length > 0) {
        email = person.emails[0]?.contact_email || person.emails[0]?.email_address || null;
      }
      
      if (email || phone) {
        return {
          email,
          phone,
          confidence: "high", // Whitepages has high accuracy
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Whitepages enrichment error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pdlApiKey = Deno.env.get("PEOPLEDATALABS_API_KEY");
    const whitepagesApiKey = Deno.env.get("WHITEPAGES_API_KEY");

    if (!pdlApiKey && !whitepagesApiKey) {
      return new Response(
        JSON.stringify({ error: "No enrichment API keys configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: EnrichmentRequest = await req.json();
    
    const { candidate_id, first_name, last_name, city, state, specialty, job_id } = body;

    if (!candidate_id || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: candidate_id, first_name, last_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enriching contact for ${first_name} ${last_name} (${candidate_id})`);

    let result: EnrichmentResult = {
      success: false,
      source: "none",
      personal_email: null,
      personal_mobile: null,
      confidence: "low",
      cost: 0,
    };

    // Step 1: Try PeopleDataLabs first (cheaper)
    if (pdlApiKey) {
      console.log("Trying PeopleDataLabs...");
      const pdlResult = await tryPDLEnrichment(pdlApiKey, first_name, last_name, city, state);
      
      if (pdlResult && (pdlResult.email || pdlResult.phone)) {
        result = {
          success: true,
          source: "PDL",
          personal_email: pdlResult.email,
          personal_mobile: pdlResult.phone,
          confidence: pdlResult.confidence as "high" | "medium" | "low",
          cost: 0.05,
        };
        console.log("PDL match found:", { email: !!pdlResult.email, phone: !!pdlResult.phone });
      }
    }

    // Step 2: If PDL didn't find results or low confidence, try Whitepages
    if (whitepagesApiKey && (!result.success || result.confidence === "low")) {
      console.log("Trying Whitepages Pro...");
      const wpResult = await tryWhitepagesEnrichment(whitepagesApiKey, first_name, last_name, city, state);
      
      if (wpResult && (wpResult.email || wpResult.phone)) {
        // If PDL found something, add Whitepages cost; otherwise just Whitepages cost
        const additionalCost = result.success ? 0.30 : 0.30;
        
        result = {
          success: true,
          source: "Whitepages",
          personal_email: wpResult.email || result.personal_email,
          personal_mobile: wpResult.phone || result.personal_mobile,
          confidence: "high",
          cost: result.cost + additionalCost,
        };
        console.log("Whitepages match found:", { email: !!wpResult.email, phone: !!wpResult.phone });
      } else if (!result.success) {
        // Even if no match, count the Whitepages lookup cost
        result.cost += 0.30;
      }
    }

    // Step 3: Update candidate record if we found something
    if (result.success && (result.personal_email || result.personal_mobile)) {
      const updateData: Record<string, any> = {
        enrichment_source: result.source,
        last_enrichment_date: new Date().toISOString(),
        enriched_at: new Date().toISOString(),
        enrichment_tier: "Platinum",
        enrichment_needed: false,
      };
      
      if (result.personal_email) updateData.personal_email = result.personal_email;
      if (result.personal_mobile) updateData.personal_mobile = result.personal_mobile;

      const { error: updateError } = await supabase
        .from("candidates")
        .update(updateData)
        .eq("id", candidate_id);

      if (updateError) {
        console.error("Failed to update candidate:", updateError);
      } else {
        console.log("Candidate updated successfully");
      }

      // Log enrichment for cost tracking
      try {
        await supabase.rpc("log_enrichment", {
          p_candidate_id: candidate_id,
          p_job_id: job_id || null,
          p_source: result.source.toLowerCase(),
          p_cost: result.cost,
          p_personal_mobile: result.personal_mobile,
          p_personal_email: result.personal_email,
        });
      } catch (rpcError) {
        console.error("Failed to log enrichment:", rpcError);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Enrichment error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
