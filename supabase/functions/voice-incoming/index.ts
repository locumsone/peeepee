import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Available Twilio numbers for rotation
const TWILIO_NUMBERS = [
  "+12185628671", // Breezy Point, MN
  "+14355628671", // Salina, UT
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    
    // Common Twilio parameters
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callStatus = formData.get("CallStatus") as string;
    const direction = formData.get("Direction") as string;
    
    // Recording parameters (if this is a recording callback)
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;
    
    // Transcription parameters (if this is a transcription callback)
    const transcriptionText = formData.get("TranscriptionText") as string;
    const transcriptionStatus = formData.get("TranscriptionStatus") as string;

    console.log("Voice webhook received:", {
      callSid,
      from,
      to,
      callStatus,
      direction,
      hasRecording: !!recordingUrl,
      hasTranscription: !!transcriptionText,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle recording callback
    if (recordingUrl && recordingSid) {
      console.log("Processing recording callback:", { recordingSid, recordingUrl, recordingDuration });
      
      // Update the call log with recording info
      const { error: updateError } = await supabase
        .from("ai_call_logs")
        .update({
          recording_url: recordingUrl,
          duration_seconds: parseInt(recordingDuration) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("retell_call_id", callSid);

      if (updateError) {
        console.error("Error updating recording:", updateError);
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle transcription callback
    if (transcriptionText && transcriptionStatus === "completed") {
      console.log("Processing transcription callback:", { transcriptionText: transcriptionText.substring(0, 100) });
      
      // Update the call log with transcription
      const { error: updateError } = await supabase
        .from("ai_call_logs")
        .update({
          transcript_text: transcriptionText,
          updated_at: new Date().toISOString(),
        })
        .eq("retell_call_id", callSid);

      if (updateError) {
        console.error("Error updating transcription:", updateError);
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle status callbacks (call ended, etc.)
    if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer") {
      console.log("Call ended with status:", callStatus);
      
      const callDuration = formData.get("CallDuration") as string;
      
      await supabase
        .from("ai_call_logs")
        .update({
          status: callStatus,
          ended_at: new Date().toISOString(),
          duration_seconds: parseInt(callDuration) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("retell_call_id", callSid);

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle incoming call - generate TwiML response
    if (direction === "inbound" || callStatus === "ringing") {
      console.log("Handling inbound call from:", from);

      // Look up caller in candidates table
      const normalizedPhone = from.replace(/\D/g, "");
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, specialty")
        .or(`phone.ilike.%${normalizedPhone},personal_mobile.ilike.%${normalizedPhone}`)
        .limit(1)
        .single();

      // Log the incoming call
      const { data: callLog, error: logError } = await supabase
        .from("ai_call_logs")
        .insert({
          phone_number: from,
          from_number: to,
          retell_call_id: callSid,
          call_type: "inbound",
          status: "in-progress",
          started_at: new Date().toISOString(),
          candidate_id: candidate?.id || null,
          candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null,
          platform: "twilio",
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Error logging call:", logError);
      }

      // Return TwiML to connect the call to the browser client
      // This dials the recruiter's browser-based softphone with recording enabled
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual" 
        recordingStatusCallback="https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/voice-incoming"
        recordingStatusCallbackEvent="completed"
        transcribe="true"
        transcribeCallback="https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/voice-incoming">
    <Client>user_recruiter-1</Client>
  </Dial>
</Response>`;

      console.log("Returning TwiML for inbound call");
      return new Response(twiml, { 
        headers: { "Content-Type": "text/xml" } 
      });
    }

    // Handle outbound call (from browser to phone)
    // This is called when the TwiML App receives a request from the Voice SDK
    const toNumber = formData.get("To") as string;
    const fromNumber = formData.get("From") as string || TWILIO_NUMBERS[0];
    const callerId = formData.get("callerId") as string;

    if (toNumber) {
      console.log("Handling outbound call to:", toNumber);

      // Look up recipient in candidates table
      const normalizedPhone = toNumber.replace(/\D/g, "");
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, specialty")
        .or(`phone.ilike.%${normalizedPhone},personal_mobile.ilike.%${normalizedPhone}`)
        .limit(1)
        .single();

      // Log the outbound call
      await supabase
        .from("ai_call_logs")
        .insert({
          phone_number: toNumber,
          from_number: callerId || TWILIO_NUMBERS[0],
          retell_call_id: callSid,
          call_type: "outbound",
          status: "in-progress",
          started_at: new Date().toISOString(),
          candidate_id: candidate?.id || null,
          candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null,
          platform: "twilio",
        });

      // TwiML to dial the number with recording and transcription
      const callerIdNumber = callerId || TWILIO_NUMBERS[0];
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}"
        record="record-from-answer-dual"
        recordingStatusCallback="https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/voice-incoming"
        recordingStatusCallbackEvent="completed"
        transcribe="true"
        transcribeCallback="https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/voice-incoming">
    <Number>${toNumber}</Number>
  </Dial>
</Response>`;

      console.log("Returning TwiML for outbound call to:", toNumber);
      return new Response(twiml, { 
        headers: { "Content-Type": "text/xml" } 
      });
    }

    // Default response if nothing matched
    console.log("No action taken, returning empty TwiML");
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );

  } catch (error) {
    console.error("Voice webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again.</Say></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
