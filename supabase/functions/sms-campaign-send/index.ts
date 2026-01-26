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
    const fallbackNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "+12185628671";

    if (!accountSid || !authToken) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Select a Twilio number using smart rotation
    // Priority: least messages sent today, then least recently used
    let selectedNumber = from_number;
    let selectedNumberId: string | null = null;

    if (!from_number) {
      // Check if this conversation already has an assigned number (for consistency)
      if (conversation_id) {
        const { data: existingConv } = await supabase
          .from("sms_conversations")
          .select("twilio_number")
          .eq("id", conversation_id)
          .maybeSingle();
        
        if (existingConv?.twilio_number) {
          selectedNumber = existingConv.twilio_number;
          console.log("Using existing conversation number:", selectedNumber);
        }
      }

      // If no existing number, get one from the pool with smart rotation
      if (!selectedNumber) {
        const { data: availableNumbers, error: numError } = await supabase
          .from("telnyx_numbers") // Table stores Twilio numbers despite legacy name
          .select("id, phone_number, messages_sent_today, daily_limit")
          .eq("status", "active")
          .lt("messages_sent_today", 200) // Under daily limit
          .order("messages_sent_today", { ascending: true })
          .order("last_used_at", { ascending: true, nullsFirst: true })
          .limit(1);

        if (numError) {
          console.error("Error fetching numbers:", numError);
        }

        if (availableNumbers && availableNumbers.length > 0) {
          selectedNumber = availableNumbers[0].phone_number;
          selectedNumberId = availableNumbers[0].id;
          console.log("Selected number from pool:", selectedNumber, "Messages today:", availableNumbers[0].messages_sent_today);
        } else {
          // Fallback if no numbers available in pool
          selectedNumber = fallbackNumber;
          console.log("No available numbers in pool, using fallback:", fallbackNumber);
        }
      }
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", to_phone);
    formData.append("From", selectedNumber);
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

    console.log("SMS sent successfully via", selectedNumber, "SID:", twilioResult.sid);

    // Update number usage stats
    if (selectedNumberId) {
      // Get current count and increment
      const { data: currentNum } = await supabase
        .from("telnyx_numbers")
        .select("messages_sent_today")
        .eq("id", selectedNumberId)
        .single();
      
      await supabase
        .from("telnyx_numbers")
        .update({
          messages_sent_today: (currentNum?.messages_sent_today || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", selectedNumberId);
    }

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
            telnyx_number: selectedNumber, // Legacy column (NOT NULL)
            twilio_number: selectedNumber,
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
        from_number: selectedNumber,
        to_number: to_phone,
      });

      // Update conversation with last message info
      await supabase
        .from("sms_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: custom_message.substring(0, 100),
          last_message_direction: "outbound",
          twilio_number: selectedNumber,
        })
        .eq("id", convId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_sid: twilioResult.sid,
        conversation_id: convId,
        from_number: selectedNumber,
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