import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting best practices for SMS (per Twilio/carrier guidelines):
// - 1 message per second per "from" number (carrier limit)
// - Spread messages over time to avoid spam detection
// - Use multiple sender numbers to increase throughput
// - Implement exponential backoff on failures

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get rate limiting settings
    const { data: settings } = await supabase
      .from("sms_send_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings?.enabled) {
      console.log("SMS queue processing is disabled");
      return new Response(
        JSON.stringify({ message: "SMS queue processing is disabled", results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchSize = settings.batch_size || 50;
    const delayMs = settings.delay_between_messages_ms || 2000;

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const { count: sentToday } = await supabase
      .from("sms_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", `${today}T00:00:00Z`);

    if ((sentToday || 0) >= settings.messages_per_day) {
      console.log(`Daily limit reached: ${sentToday}/${settings.messages_per_day}`);
      return new Response(
        JSON.stringify({ message: "Daily SMS limit reached", results, sentToday }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pending messages (oldest first, respect priority)
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("sms_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch queue: ${fetchError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("No pending messages in queue");
      return new Response(
        JSON.stringify({ message: "No pending messages", results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingMessages.length} messages (batch size: ${batchSize})`);

    // Get available sender numbers (from any active Twilio number in the pool)
    const { data: availableNumbers } = await supabase
      .from("telnyx_numbers")
      .select("id, phone_number, messages_sent_today, daily_limit")
      .eq("status", "active")
      .lt("messages_sent_today", 200)
      .order("messages_sent_today", { ascending: true });

    if (!availableNumbers || availableNumbers.length === 0) {
      console.log("No available sender numbers");
      return new Response(
        JSON.stringify({ message: "No available sender numbers", results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = btoa(`${accountSid}:${authToken}`);

    // Process messages with rate limiting
    let numberIndex = 0;
    const processedCampaigns = new Set<string>();

    for (const msg of pendingMessages) {
      results.processed++;

      // Mark as processing
      await supabase
        .from("sms_queue")
        .update({ status: "processing", last_error: null })
        .eq("id", msg.id);

      try {
        // Rotate through sender numbers
        const senderNum = availableNumbers[numberIndex % availableNumbers.length];
        numberIndex++;

        // Normalize phone
        const toPhone = normalizePhone(msg.phone_to);

        // Send via Twilio
        const formData = new URLSearchParams();
        formData.append("To", toPhone);
        formData.append("From", senderNum.phone_number);
        formData.append("Body", msg.message_body);

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
          throw new Error(twilioResult.message || `Twilio error: ${twilioResponse.status}`);
        }

        // Update queue item as sent
        await supabase
          .from("sms_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            twilio_sid: twilioResult.sid,
            from_number: senderNum.phone_number,
            attempts: (msg.attempts || 0) + 1,
          })
          .eq("id", msg.id);

        // Update sender number usage
        await supabase
          .from("telnyx_numbers")
          .update({
            messages_sent_today: (senderNum.messages_sent_today || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", senderNum.id);

        // Track campaign for stats update
        if (msg.campaign_id) {
          processedCampaigns.add(msg.campaign_id);
        }

        // Create conversation and message record
        await createConversationRecord(supabase, {
          toPhone,
          fromNumber: senderNum.phone_number,
          messageBody: msg.message_body,
          candidateId: msg.candidate_id,
          contactName: msg.contact_name,
          twilioSid: twilioResult.sid,
        });

        results.sent++;
        console.log(`✓ Sent to ${toPhone} via ${senderNum.phone_number}`);

        // Rate limiting delay between messages
        if (results.processed < pendingMessages.length) {
          await sleep(delayMs);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const newAttempts = (msg.attempts || 0) + 1;
        const shouldRetry = newAttempts < (msg.max_attempts || 3);

        await supabase
          .from("sms_queue")
          .update({
            status: shouldRetry ? "pending" : "failed",
            last_error: errorMsg,
            attempts: newAttempts,
            // Exponential backoff: 5min, 15min, 45min
            scheduled_for: shouldRetry
              ? new Date(Date.now() + Math.pow(3, newAttempts) * 5 * 60 * 1000).toISOString()
              : undefined,
          })
          .eq("id", msg.id);

        results.failed++;
        console.error(`✗ Failed ${msg.phone_to}: ${errorMsg}`);
      }
    }

    // Update campaign stats
    for (const campaignId of processedCampaigns) {
      const { count: sentCount } = await supabase
        .from("sms_queue")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "sent");

      const { count: pendingCount } = await supabase
        .from("sms_queue")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      const { count: failedCount } = await supabase
        .from("sms_queue")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      await supabase
        .from("campaigns")
        .update({
          sms_sent: sentCount || 0,
          sms_queued: pendingCount || 0,
          sms_failed: failedCount || 0,
        })
        .eq("id", campaignId);
    }

    const duration = Date.now() - startTime;
    console.log(`Batch complete: ${results.sent} sent, ${results.failed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        duration,
        availableNumbers: availableNumbers.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Queue processing error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message, results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// deno-lint-ignore no-explicit-any
async function createConversationRecord(
  supabase: any,
  data: {
    toPhone: string;
    fromNumber: string;
    messageBody: string;
    candidateId?: string;
    contactName?: string;
    twilioSid: string;
  }
) {
  // Find or create conversation
  const { data: existingConv } = await supabase
    .from("sms_conversations")
    .select("id")
    .eq("candidate_phone", data.toPhone)
    .maybeSingle();

  let convId: string;

  if (existingConv) {
    convId = existingConv.id;
  } else {
    const { data: newConv, error } = await supabase
      .from("sms_conversations")
      .insert({
        candidate_phone: data.toPhone,
        candidate_id: data.candidateId || null,
        contact_name: data.contactName || null,
        telnyx_number: data.fromNumber,
        twilio_number: data.fromNumber,
        last_message_at: new Date().toISOString(),
        last_message_preview: data.messageBody.substring(0, 100),
        last_message_direction: "outbound",
        unread_count: 0,
        total_messages: 1,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return;
    }
    convId = newConv.id;
  }

  // Insert message record
  await supabase.from("sms_messages").insert({
    conversation_id: convId,
    direction: "outbound",
    body: data.messageBody,
    status: "sent",
    twilio_sid: data.twilioSid,
    from_number: data.fromNumber,
    to_number: data.toPhone,
  });

  // Update conversation
  await supabase
    .from("sms_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: data.messageBody.substring(0, 100),
      last_message_direction: "outbound",
      twilio_number: data.fromNumber,
    })
    .eq("id", convId);
}
