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
    // Parse Twilio's URL-encoded form data
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log("Inbound SMS received:", { from, to, bodyPreview: body?.substring(0, 50), messageSid });

    if (!from || !body) {
      console.error("Missing required fields");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find existing conversation by phone number
    const { data: conversation, error: convError } = await supabase
      .from("sms_conversations")
      .select("id, unread_count, candidate_id")
      .eq("candidate_phone", from)
      .maybeSingle();

    if (convError) {
      console.error("Error finding conversation:", convError);
    }

    let conversationId = conversation?.id;

    // If no conversation exists, create one
    if (!conversationId) {
      console.log("Creating new conversation for:", from);
      const { data: newConv, error: createError } = await supabase
        .from("sms_conversations")
        .insert({
          candidate_phone: from,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.substring(0, 100),
          unread_count: 1,
          candidate_replied: true,
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
      } else {
        conversationId = newConv.id;
      }
    }

    // Insert the inbound message
    if (conversationId) {
      const { error: msgError } = await supabase.from("sms_messages").insert({
        conversation_id: conversationId,
        direction: "inbound",
        body: body,
        status: "received",
        twilio_sid: messageSid,
        from_number: from,
        to_number: to,
      });

      if (msgError) {
        console.error("Error inserting message:", msgError);
      } else {
        console.log("Message inserted successfully");
      }

      // Detect interest keywords
      const interestKeywords = ["interested", "yes", "available", "call me", "tell me more", "sounds good", "let's talk"];
      const hasInterest = interestKeywords.some(k => body.toLowerCase().includes(k));

      // Update conversation metadata
      const updateData: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
        unread_count: (conversation?.unread_count || 0) + 1,
        candidate_replied: true,
      };

      if (hasInterest) {
        updateData.interest_detected = true;
      }

      const { error: updateError } = await supabase
        .from("sms_conversations")
        .update(updateData)
        .eq("id", conversationId);

      if (updateError) {
        console.error("Error updating conversation:", updateError);
      }
    }

    // Return TwiML response to acknowledge receipt
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error: unknown) {
    console.error("Error in twilio-webhook:", error);
    // Still return valid TwiML even on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
