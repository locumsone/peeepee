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
    const { to_phone, custom_message, from_number, candidate_id, conversation_id, contact_name } = await req.json();

    if (!to_phone || !custom_message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_phone and custom_message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const defaultFromNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "+12185628671";

    if (!accountSid || !authToken) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromPhone = from_number || defaultFromNumber;

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", to_phone);
    formData.append("From", fromPhone);
    formData.append("Body", custom_message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      return new Response(
        JSON.stringify({ error: twilioResult.message || "Failed to send SMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS sent successfully:", twilioResult.sid);

    // Update database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find or create conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: existingConv } = await supabase
        .from("sms_conversations")
        .select("id")
        .eq("candidate_phone", to_phone)
        .maybeSingle();

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("sms_conversations")
          .insert({
            candidate_phone: to_phone,
            candidate_id: candidate_id || null,
            contact_name: contact_name || null,
            telnyx_number: fromPhone, // Required NOT NULL field
            twilio_number: fromPhone,
            last_message_at: new Date().toISOString(),
            last_message_preview: custom_message.substring(0, 100),
            last_message_direction: "outbound",
            unread_count: 0,
            total_messages: 1,
          })
          .select("id")
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
        } else {
          convId = newConv.id;
          console.log("Created new conversation:", convId);
        }
      }
    }

    // Insert message record
    if (convId) {
      await supabase.from("sms_messages").insert({
        conversation_id: convId,
        direction: "outbound",
        body: custom_message,
        status: "sent",
        twilio_sid: twilioResult.sid,
        from_number: fromPhone,
        to_number: to_phone,
      });

      // Update conversation with last message info
      await supabase
        .from("sms_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: custom_message.substring(0, 100),
          last_message_direction: "outbound",
        })
        .eq("id", convId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_sid: twilioResult.sid,
        conversation_id: convId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in sms-campaign-send:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
