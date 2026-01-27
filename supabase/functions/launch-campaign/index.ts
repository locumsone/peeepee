import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CandidatePayload {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string;
  state?: string;
  tier?: number;
  unified_score?: string;
  icebreaker?: string;
  talking_points?: string[];
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
}

interface ChannelConfig {
  email?: {
    sender: string;
    sequenceLength: number;
    gapDays: number;
  } | null;
  sms?: {
    fromNumber: string;
    sequenceLength: number;
  } | null;
  aiCall?: {
    fromNumber: string;
    callDay: number;
    transferTo: string;
  } | null;
  linkedin?: boolean;
  schedule?: {
    startDate: string;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    weekdaysOnly: boolean;
  };
}

interface LaunchRequest {
  job_id: string;
  campaign_name: string;
  sender_email: string;
  channels: ChannelConfig;
  candidates: CandidatePayload[];
  playbook_data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: LaunchRequest = await req.json();
    const { job_id, campaign_name, sender_email, channels, candidates, playbook_data } = body;

    console.log(`[launch-campaign] Starting launch for job ${job_id} with ${candidates.length} candidates`);

    // 1. Create campaign record
    const activeChannels = Object.keys(channels)
      .filter((k) => {
        const val = channels[k as keyof ChannelConfig];
        return val && (typeof val === "boolean" ? val : true);
      })
      .join(",");

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name: campaign_name,
        job_id,
        status: "active",
        channel: activeChannels,
        sender_account: sender_email,
        leads_count: candidates.length,
        playbook_data: playbook_data || null,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("[launch-campaign] Failed to create campaign:", campaignError);
      throw new Error(`Failed to create campaign: ${campaignError.message}`);
    }

    console.log(`[launch-campaign] Created campaign ${campaign.id}`);

    // 2. Insert campaign_leads_v2 with personalization data
    const leadsToInsert = candidates.map((c) => ({
      campaign_id: campaign.id,
      candidate_id: c.id,
      candidate_name: `${c.first_name} ${c.last_name}`,
      candidate_email: c.email,
      candidate_phone: c.phone,
      candidate_specialty: c.specialty || null,
      candidate_state: c.state || null,
      match_score: c.unified_score ? parseInt(c.unified_score, 10) : null,
      tier: c.tier || null,
      notes: c.icebreaker
        ? `Icebreaker: ${c.icebreaker}\n\nTalking Points:\n${(c.talking_points || []).map((tp, i) => `${i + 1}. ${tp}`).join("\n")}`
        : null,
      status: "pending",
    }));

    const { error: leadsError } = await supabase.from("campaign_leads_v2").insert(leadsToInsert);

    if (leadsError) {
      console.error("[launch-campaign] Failed to insert leads:", leadsError);
      // Don't throw - continue with campaign, leads are not critical
    } else {
      console.log(`[launch-campaign] Inserted ${leadsToInsert.length} leads`);
    }

    // Stats tracking
    let smsQueued = 0;
    let emailsQueued = 0;
    let callsQueued = 0;

    // 3. Queue SMS messages for Day 1 (if SMS channel enabled)
    if (channels.sms) {
      const candidatesWithPhone = candidates.filter((c) => c.phone);
      console.log(`[launch-campaign] SMS enabled, ${candidatesWithPhone.length} candidates with phone`);

      for (const candidate of candidatesWithPhone) {
        try {
          // Use the custom SMS message if available, otherwise use a template
          const smsBody =
            candidate.sms_message ||
            `Hi Dr. ${candidate.last_name}, I'm reaching out about a locums opportunity that matches your profile. Would you be available for a quick call? - Sent via LocumsOne`;

          const { error: smsError } = await supabase.functions.invoke("sms-campaign-send", {
            body: {
              to: candidate.phone,
              body: smsBody,
              campaign_id: campaign.id,
              candidate_id: candidate.id,
              candidate_name: `${candidate.first_name} ${candidate.last_name}`,
              job_id,
            },
          });

          if (!smsError) {
            smsQueued++;
          } else {
            console.error(`[launch-campaign] SMS send failed for ${candidate.first_name}:`, smsError);
          }
        } catch (err) {
          console.error(`[launch-campaign] SMS error for ${candidate.first_name}:`, err);
        }
      }
      console.log(`[launch-campaign] Queued ${smsQueued} SMS messages`);
    }

    // 4. Queue AI Calls (if AI Call channel enabled)
    if (channels.aiCall) {
      const candidatesWithPhone = candidates.filter((c) => c.phone);
      console.log(`[launch-campaign] AI Calls enabled, ${candidatesWithPhone.length} candidates with phone`);

      // Get job details for call context
      const { data: jobData } = await supabase.from("jobs").select("*").eq("id", job_id).single();

      const callsToInsert = candidatesWithPhone.map((c) => ({
        campaign_id: campaign.id,
        candidate_id: c.id,
        candidate_name: `${c.first_name} ${c.last_name}`,
        phone: c.phone,
        job_id,
        job_title: jobData?.specialty || jobData?.job_name || "Locums Opportunity",
        job_state: jobData?.state || null,
        job_pay: jobData?.pay_rate ? `$${jobData.pay_rate}/hr` : null,
        recruiter_phone: channels.aiCall?.transferTo || null,
        status: "queued",
        priority: c.tier === 1 ? 1 : c.tier === 2 ? 2 : 3,
        scheduled_at: new Date().toISOString(),
        source: "campaign_launch",
      }));

      const { error: callsError } = await supabase.from("ai_call_queue").insert(callsToInsert);

      if (!callsError) {
        callsQueued = callsToInsert.length;
        console.log(`[launch-campaign] Queued ${callsQueued} AI calls`);
      } else {
        console.error("[launch-campaign] Failed to queue calls:", callsError);
      }
    }

    // 5. Create Instantly email campaign (if email channel enabled)
    if (channels.email) {
      const instantlyApiKey = Deno.env.get("INSTANTLY_API_KEY");
      if (instantlyApiKey) {
        const candidatesWithEmail = candidates.filter((c) => c.email);
        console.log(`[launch-campaign] Email enabled, ${candidatesWithEmail.length} candidates with email`);

        try {
          // Create campaign in Instantly
          const campaignCreateRes = await fetch("https://api.instantly.ai/api/v1/campaign/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${instantlyApiKey}`,
            },
            body: JSON.stringify({
              name: campaign_name,
              sending_account: sender_email,
            }),
          });

          if (campaignCreateRes.ok) {
            const instantlyCampaign = await campaignCreateRes.json();
            const instantlyCampaignId = instantlyCampaign.id;

            // Update our campaign with external ID
            await supabase
              .from("campaigns")
              .update({ external_id: instantlyCampaignId })
              .eq("id", campaign.id);

            // Add leads to Instantly
            for (const candidate of candidatesWithEmail) {
              try {
                const leadRes = await fetch("https://api.instantly.ai/api/v1/lead/add", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${instantlyApiKey}`,
                  },
                  body: JSON.stringify({
                    campaign_id: instantlyCampaignId,
                    email: candidate.email,
                    first_name: candidate.first_name,
                    last_name: candidate.last_name,
                    custom_variables: {
                      icebreaker: candidate.icebreaker || "",
                      talking_points: (candidate.talking_points || []).join("; "),
                    },
                  }),
                });

                if (leadRes.ok) {
                  emailsQueued++;
                }
              } catch (err) {
                console.error(`[launch-campaign] Instantly lead add error for ${candidate.email}:`, err);
              }
            }

            // Launch the campaign
            await fetch("https://api.instantly.ai/api/v1/campaign/launch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${instantlyApiKey}`,
              },
              body: JSON.stringify({ campaign_id: instantlyCampaignId }),
            });

            console.log(`[launch-campaign] Created Instantly campaign ${instantlyCampaignId} with ${emailsQueued} leads`);
          }
        } catch (err) {
          console.error("[launch-campaign] Instantly API error:", err);
        }
      } else {
        console.log("[launch-campaign] INSTANTLY_API_KEY not configured, skipping email");
      }
    }

    // 6. Log activity
    await supabase.from("activity_log").insert({
      action_type: "campaign_launched",
      entity_type: "campaign",
      entity_id: campaign.id,
      job_id,
      campaign_id: campaign.id,
      user_name: "System",
      metadata: {
        campaign_name,
        leads_count: candidates.length,
        sms_queued: smsQueued,
        emails_queued: emailsQueued,
        calls_queued: callsQueued,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        message: `Campaign launched with ${candidates.length} candidates`,
        stats: {
          emails_queued: emailsQueued,
          sms_queued: smsQueued,
          calls_queued: callsQueued,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[launch-campaign] Error:", error);
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
