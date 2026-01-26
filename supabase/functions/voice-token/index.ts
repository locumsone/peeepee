import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Twilio access token generation for Voice SDK
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error("user_id is required");
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKey = Deno.env.get("TWILIO_API_KEY");
    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      console.error("Missing Twilio credentials:", {
        hasAccountSid: !!accountSid,
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasTwimlAppSid: !!twimlAppSid,
      });
      throw new Error("Missing Twilio credentials");
    }

    // Generate JWT token for Twilio Voice SDK
    // Using Twilio's AccessToken generation logic
    const identity = `user_${user_id}`;
    
    // Create the token using Twilio's token format
    const header = {
      typ: "JWT",
      alg: "HS256",
      cty: "twilio-fpa;v=1",
    };

    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour

    const payload = {
      jti: `${apiKey}-${now}`,
      iss: apiKey,
      sub: accountSid,
      exp: now + ttl,
      grants: {
        identity: identity,
        voice: {
          incoming: {
            allow: true,
          },
          outgoing: {
            application_sid: twimlAppSid,
          },
        },
      },
    };

    // Base64URL encode
    const base64UrlEncode = (obj: unknown): string => {
      const json = JSON.stringify(obj);
      const base64 = btoa(json);
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);

    // Sign with HMAC-SHA256
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    console.log("Generated voice token for identity:", identity);

    return new Response(
      JSON.stringify({ token, identity }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating voice token:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
