import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstantlyEvent {
  event_type: string;
  campaign_id?: string;
  email?: string;
  lead_email?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload: InstantlyEvent = await req.json();
    console.log('Instantly webhook received:', JSON.stringify(payload));

    const eventType = payload.event_type?.toLowerCase();
    const instantlyCampaignId = payload.campaign_id;
    const leadEmail = payload.lead_email || payload.email;

    if (!instantlyCampaignId) {
      console.log('No campaign_id in payload, skipping');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the campaign by external_id (Instantly campaign ID)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('external_id', instantlyCampaignId)
      .maybeSingle();

    if (campaignError || !campaign) {
      console.log('Campaign not found for external_id:', instantlyCampaignId);
      return new Response(JSON.stringify({ success: true, campaign_not_found: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the lead if email is provided
    let leadId: string | null = null;
    if (leadEmail) {
      const { data: lead } = await supabase
        .from('campaign_leads_v2')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('candidate_email', leadEmail)
        .maybeSingle();
      
      leadId = lead?.id || null;
    }

    // Map Instantly event types to our event types and stats columns
    let statColumn: string | null = null;
    let mappedEventType = eventType;

    switch (eventType) {
      case 'email_sent':
      case 'sent':
        statColumn = 'emails_sent';
        mappedEventType = 'email_sent';
        break;
      case 'email_opened':
      case 'opened':
      case 'open':
        statColumn = 'emails_opened';
        mappedEventType = 'email_opened';
        break;
      case 'email_clicked':
      case 'clicked':
      case 'click':
        statColumn = 'emails_clicked';
        mappedEventType = 'email_clicked';
        break;
      case 'email_replied':
      case 'replied':
      case 'reply':
        statColumn = 'emails_replied';
        mappedEventType = 'email_replied';
        break;
      case 'email_bounced':
      case 'bounced':
      case 'bounce':
        statColumn = 'emails_bounced';
        mappedEventType = 'email_bounced';
        break;
      default:
        console.log('Unknown event type:', eventType);
    }

    // Insert event record
    await supabase.from('campaign_events').insert({
      campaign_id: campaign.id,
      lead_id: leadId,
      event_type: mappedEventType,
      channel: 'email',
      metadata: payload.metadata || { original_event: eventType },
      external_id: instantlyCampaignId,
    });

    // Update campaign stats if we have a valid stat column
    if (statColumn) {
      // Use raw SQL to increment the counter
      const { error: updateError } = await supabase.rpc('increment_campaign_stat', {
        p_instantly_campaign_id: instantlyCampaignId,
        p_stat: statColumn,
      });

      if (updateError) {
        console.error('Error updating campaign stat:', updateError);
        // Fallback: direct update
        const { data: currentCampaign } = await supabase
          .from('campaigns')
          .select(statColumn)
          .eq('id', campaign.id)
          .single();

        if (currentCampaign && typeof currentCampaign === 'object' && statColumn in currentCampaign) {
          const currentValue = (currentCampaign as unknown as Record<string, number>)[statColumn] || 0;
          await supabase
            .from('campaigns')
            .update({ [statColumn]: currentValue + 1 })
            .eq('id', campaign.id);
        }
      }

      // Update lead-level stats if we have a lead
      if (leadId && (statColumn === 'emails_sent' || statColumn === 'emails_opened' || statColumn === 'emails_replied')) {
        const leadStatMap: Record<string, string> = {
          'emails_sent': 'emails_sent',
          'emails_opened': 'emails_opened',
          'emails_replied': 'emails_replied',
        };
        
        const leadColumn = leadStatMap[statColumn];
        if (leadColumn) {
          const { data: currentLead } = await supabase
            .from('campaign_leads_v2')
            .select(leadColumn)
            .eq('id', leadId)
            .single();

          if (currentLead && typeof currentLead === 'object' && leadColumn in currentLead) {
            const currentValue = (currentLead as unknown as Record<string, number>)[leadColumn] || 0;
            await supabase
              .from('campaign_leads_v2')
              .update({ [leadColumn]: currentValue + 1, last_contact_at: new Date().toISOString() })
              .eq('id', leadId);
          }
        }
      }
    }

    console.log(`Processed ${mappedEventType} event for campaign ${campaign.id}`);

    return new Response(JSON.stringify({ success: true, processed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Instantly webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
