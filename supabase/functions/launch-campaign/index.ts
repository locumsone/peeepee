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
    provider?: 'instantly' | 'gmail' | 'smtp';
    sender: string;
    senderName?: string;
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

    // 3. Queue SMS messages for batch sending (rate-limited to avoid carrier spam)
    // Best practices: 1 msg/sec per number, spread over time, use multiple numbers
    if (channels.sms) {
      const candidatesWithPhone = candidates.filter((c) => c.phone);
      console.log(`[launch-campaign] SMS enabled, queueing ${candidatesWithPhone.length} messages for batch send`);

      // Calculate staggered send times (spread messages over time)
      const now = new Date();
      const messagesPerMinute = 30; // Conservative rate
      const delayBetweenMessages = 60000 / messagesPerMinute; // ms between each message

      const smsQueueItems = candidatesWithPhone.map((candidate, index) => {
        const smsBody =
          candidate.sms_message ||
          `Hi Dr. ${candidate.last_name}, I'm reaching out about a locums opportunity that matches your profile. Would you be available for a quick call? - Sent via LocumsOne`;

        // Stagger send times: first batch immediate, then spread out
        const scheduledTime = new Date(now.getTime() + index * delayBetweenMessages);

        return {
          campaign_id: campaign.id,
          job_id,
          candidate_id: candidate.id,
          phone_to: candidate.phone,
          message_body: smsBody,
          contact_name: `${candidate.first_name} ${candidate.last_name}`,
          status: "pending",
          priority: candidate.tier === 1 ? 10 : candidate.tier === 2 ? 5 : 1,
          scheduled_for: scheduledTime.toISOString(),
          attempts: 0,
          max_attempts: 3,
          personalization_data: {
            icebreaker: candidate.icebreaker,
            talking_points: candidate.talking_points,
          },
        };
      });

      // Batch insert into queue
      const { error: queueError } = await supabase.from("sms_queue").insert(smsQueueItems);

      if (!queueError) {
        smsQueued = smsQueueItems.length;
        console.log(`[launch-campaign] Queued ${smsQueued} SMS messages for batch processing`);

        // Update campaign with queue count
        await supabase
          .from("campaigns")
          .update({ sms_queued: smsQueued })
          .eq("id", campaign.id);
      } else {
        console.error("[launch-campaign] Failed to queue SMS:", queueError);
      }
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

    // 5. Send emails (via Gmail/SMTP or Instantly based on provider)
    if (channels.email) {
      const candidatesWithEmail = candidates.filter((c) => c.email);
      console.log(`[launch-campaign] Email enabled (${channels.email.provider || 'instantly'}), ${candidatesWithEmail.length} candidates with email`);

      const emailProvider = channels.email.provider || 'instantly';

      if (emailProvider === 'gmail' || emailProvider === 'smtp') {
        // Use Gmail/SMTP
        for (const candidate of candidatesWithEmail) {
          try {
            const emailSubject = candidate.email_subject || `Opportunity for Dr. ${candidate.last_name}`;
            const emailBody = candidate.email_body || `Hi Dr. ${candidate.last_name},\n\n${candidate.icebreaker || 'I wanted to reach out about an exciting locums opportunity.'}\n\nBest regards`;

            const { error: emailError } = await supabase.functions.invoke("send-email-smtp", {
              body: {
                to: candidate.email,
                subject: emailSubject,
                html: emailBody.replace(/\n/g, '<br>'),
                from_email: channels.email.sender,
                from_name: channels.email.senderName || channels.email.sender.split('@')[0],
                campaign_id: campaign.id,
                candidate_id: candidate.id,
              },
            });

            if (!emailError) {
              emailsQueued++;
            } else {
              console.error(`[launch-campaign] SMTP email error for ${candidate.email}:`, emailError);
            }
          } catch (err) {
            console.error(`[launch-campaign] Email error for ${candidate.email}:`, err);
          }
        }
        console.log(`[launch-campaign] Sent ${emailsQueued} emails via ${emailProvider.toUpperCase()}`);
      } else {
        // Use Instantly v2 API
        const instantlyApiKey = Deno.env.get("INSTANTLY_API_KEY");
        if (instantlyApiKey) {
          try {
            // Build schedule config
            const scheduleConfig = channels.schedule || {
              startDate: new Date().toISOString().split('T')[0],
              sendWindowStart: "09:00",
              sendWindowEnd: "17:00",
              timezone: "America/New_York",
              weekdaysOnly: true,
            };

            // Instantly v2 campaign creation with full payload
            const campaignPayload = {
              name: campaign_name,
              email_list: [sender_email],
              campaign_schedule: {
                schedules: [
                  {
                    name: "Default Schedule",
                    days: {
                      sunday: !scheduleConfig.weekdaysOnly,
                      monday: true,
                      tuesday: true,
                      wednesday: true,
                      thursday: true,
                      friday: true,
                      saturday: !scheduleConfig.weekdaysOnly,
                    },
                    timezone: scheduleConfig.timezone || "America/New_York",
                    timing: {
                      from: scheduleConfig.sendWindowStart || "09:00",
                      to: scheduleConfig.sendWindowEnd || "17:00",
                    },
                  },
                ],
              },
            };

            console.log(`[launch-campaign] Creating Instantly v2 campaign:`, JSON.stringify(campaignPayload));

            const campaignCreateRes = await fetch("https://api.instantly.ai/api/v2/campaigns", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${instantlyApiKey}`,
              },
              body: JSON.stringify(campaignPayload),
            });

            if (campaignCreateRes.ok) {
              const instantlyCampaign = await campaignCreateRes.json();
              const instantlyCampaignId = instantlyCampaign.id;

              console.log(`[launch-campaign] Created Instantly campaign: ${instantlyCampaignId}`);

              // Update our campaign with external ID
              await supabase
                .from("campaigns")
                .update({ external_id: instantlyCampaignId })
                .eq("id", campaign.id);

              // Instantly v2 - Add leads in batch (more efficient)
              const leadsPayload = candidatesWithEmail.map(candidate => ({
                email: candidate.email,
                first_name: candidate.first_name,
                last_name: candidate.last_name,
                payload: {
                  icebreaker: candidate.icebreaker || "",
                  talking_points: (candidate.talking_points || []).join("; "),
                  specialty: candidate.specialty || "",
                },
              }));

              // v2 API uses campaign (not campaign_id)
              const leadAddRes = await fetch("https://api.instantly.ai/api/v2/leads", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${instantlyApiKey}`,
                },
                body: JSON.stringify({
                  campaign: instantlyCampaignId,
                  leads: leadsPayload,
                  skip_if_in_campaign: true,
                }),
              });

              if (leadAddRes.ok) {
                emailsQueued = candidatesWithEmail.length;
                console.log(`[launch-campaign] Added ${emailsQueued} leads to Instantly`);
              } else {
                const leadError = await leadAddRes.text();
                console.error(`[launch-campaign] Instantly lead add error:`, leadError);
              }

              // Instantly v2 - Activate campaign
              const activateRes = await fetch(`https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}/activate`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${instantlyApiKey}`,
                },
              });

              if (activateRes.ok) {
                console.log(`[launch-campaign] Activated Instantly campaign ${instantlyCampaignId}`);
              } else {
                const activateError = await activateRes.text();
                console.error(`[launch-campaign] Instantly activation error:`, activateError);
              }

              console.log(`[launch-campaign] Completed Instantly v2 setup with ${emailsQueued} leads`);
            } else {
              const errorText = await campaignCreateRes.text();
              console.error(`[launch-campaign] Instantly v2 campaign creation failed:`, errorText);
            }
          } catch (err) {
            console.error("[launch-campaign] Instantly API error:", err);
          }
        } else {
          console.log("[launch-campaign] INSTANTLY_API_KEY not configured, skipping Instantly email");
        }
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
