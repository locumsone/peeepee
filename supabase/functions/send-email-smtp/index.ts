import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  campaign_id?: string;
  candidate_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EmailRequest = await req.json();
    const { to, subject, html, from_email, from_name, reply_to, campaign_id, candidate_id } = body;

    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }

    // Get SMTP credentials from secrets
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("GMAIL_USER") || Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD") || Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPass) {
      console.error("[send-email-smtp] Missing SMTP credentials");
      throw new Error("SMTP credentials not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    const senderEmail = from_email || smtpUser;
    const senderName = from_name || senderEmail.split("@")[0];

    console.log(`[send-email-smtp] Sending email to ${to} from ${senderEmail}`);

    const client = new SmtpClient();

    // Connect to SMTP server
    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    });

    // Send the email
    await client.send({
      from: `${senderName} <${senderEmail}>`,
      to: to,
      subject: subject,
      content: html,
      html: html,
      replyTo: reply_to || senderEmail,
    });

    await client.close();

    console.log(`[send-email-smtp] Email sent successfully to ${to}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${to}`,
        campaign_id,
        candidate_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-email-smtp] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
