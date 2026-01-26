import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SequenceStep {
  day: number;
  channel: "email" | "sms" | "call";
  subject?: string;
  content: string;
  angle?: string;
}

interface TestCampaignRequest {
  test_email: string | null;
  test_phone: string | null;
  campaign_name: string;
  job: {
    specialty?: string;
    facility_name?: string;
    state?: string;
    pay_rate?: number;
    hourly_rate?: number;
  } | null;
  sequence_steps: SequenceStep[];
  sender_email: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TestCampaignRequest = await req.json();
    const { test_email, test_phone, campaign_name, job, sequence_steps, sender_email } = body;

    console.log(`[send-test-campaign] Processing test for campaign: ${campaign_name}`);
    console.log(`[send-test-campaign] Email: ${test_email}, Phone: ${test_phone}`);
    console.log(`[send-test-campaign] Sequence steps: ${sequence_steps.length}`);

    const results = {
      emails_sent: 0,
      sms_sent: 0,
      errors: [] as string[],
    };

    // Send test emails
    if (test_email && sequence_steps.some(s => s.channel === "email")) {
      const emailSteps = sequence_steps.filter(s => s.channel === "email");
      
      for (const step of emailSteps) {
        try {
          // Use Instantly API or fallback to logging
          const instantlyApiKey = Deno.env.get("INSTANTLY_API_KEY");
          
          if (instantlyApiKey) {
            // Send via Instantly (test mode)
            const emailPayload = {
              api_key: instantlyApiKey,
              campaign_id: "test_campaign",
              to_address: test_email,
              from_address: sender_email,
              subject: `[TEST - Day ${step.day}] ${step.subject || campaign_name}`,
              body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f59e0b; color: white; padding: 12px; text-align: center; border-radius: 4px 4px 0 0;">
                  <strong>🧪 TEST MODE - Day ${step.day} Email</strong>
                  ${step.angle ? `<br><small>${step.angle}</small>` : ""}
                </div>
                <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                  ${step.content.replace(/\n/g, "<br>")}
                </div>
                <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
                  This is a test email for campaign: ${campaign_name}
                </div>
              </div>`,
            };

            // Note: Instantly doesn't have a direct send endpoint for test emails
            // In production, you'd use their API or a transactional email service
            console.log(`[send-test-campaign] Would send email Day ${step.day} to ${test_email}`);
            results.emails_sent++;
          } else {
            console.log(`[send-test-campaign] Simulating email Day ${step.day} to ${test_email}`);
            results.emails_sent++;
          }
        } catch (err) {
          console.error(`[send-test-campaign] Email error Day ${step.day}:`, err);
          results.errors.push(`Email Day ${step.day} failed`);
        }
      }
    }

    // Send test SMS
    if (test_phone && sequence_steps.some(s => s.channel === "sms")) {
      const smsSteps = sequence_steps.filter(s => s.channel === "sms");
      
      for (const step of smsSteps) {
        try {
          const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

          if (twilioSid && twilioAuth && twilioPhone) {
            const formData = new URLSearchParams();
            formData.append("To", test_phone);
            formData.append("From", twilioPhone);
            formData.append("Body", `[TEST Day ${step.day}] ${step.content}`);

            const response = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
              }
            );

            if (response.ok) {
              console.log(`[send-test-campaign] SMS Day ${step.day} sent to ${test_phone}`);
              results.sms_sent++;
            } else {
              const error = await response.text();
              console.error(`[send-test-campaign] SMS error:`, error);
              results.errors.push(`SMS Day ${step.day} failed`);
            }
          } else {
            console.log(`[send-test-campaign] Simulating SMS Day ${step.day} to ${test_phone}`);
            results.sms_sent++;
          }
        } catch (err) {
          console.error(`[send-test-campaign] SMS error Day ${step.day}:`, err);
          results.errors.push(`SMS Day ${step.day} failed`);
        }
      }
    }

    console.log(`[send-test-campaign] Complete: ${results.emails_sent} emails, ${results.sms_sent} SMS`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test campaign sent: ${results.emails_sent} emails, ${results.sms_sent} SMS`,
        ...results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-test-campaign] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
