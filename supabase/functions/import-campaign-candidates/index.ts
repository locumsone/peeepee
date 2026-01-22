import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlphaSophiaCandidate {
  id: string;
  alpha_sophia_id?: string;
  npi?: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  city?: string;
  state?: string;
  licenses?: string[];
  work_email?: string;
  work_phone?: string;
  source?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { 
      candidates, 
      campaign_id, 
      job_id,
      user_id 
    }: { 
      candidates: AlphaSophiaCandidate[]; 
      campaign_id: string;
      job_id?: string;
      user_id?: string;
    } = await req.json();
    
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates provided');
    }
    
    if (!campaign_id) {
      throw new Error('campaign_id is required');
    }

    console.log(`Importing ${candidates.length} candidates to campaign ${campaign_id}`);

    const importedIds: string[] = [];
    const skippedIds: string[] = [];
    let alphaSophiaImported = 0;

    for (const candidate of candidates) {
      // Check if this is an Alpha Sophia candidate (id starts with 'as_')
      if (candidate.source === 'alpha_sophia' || candidate.id.startsWith('as_')) {
        // Import to database using the function
        const { data: importedId, error: importError } = await supabase.rpc('import_alpha_sophia_candidate', {
          p_external_id: candidate.alpha_sophia_id || candidate.id.replace('as_', ''),
          p_first_name: candidate.first_name,
          p_last_name: candidate.last_name,
          p_email: candidate.work_email || null,
          p_phone: candidate.work_phone || null,
          p_specialty: candidate.specialty || null,
          p_city: candidate.city || null,
          p_state: candidate.state || null,
          p_licenses: candidate.licenses || null,
          p_npi: candidate.npi || null,
        });

        if (importError) {
          console.error(`Error importing candidate ${candidate.id}:`, importError);
          skippedIds.push(candidate.id);
          continue;
        }

        if (importedId) {
          importedIds.push(importedId);
          alphaSophiaImported++;
          
          // Add to campaign leads
          const { error: leadError } = await supabase
            .from('campaign_leads_v2')
            .insert({
              campaign_id,
              candidate_id: importedId,
              candidate_name: `${candidate.first_name} ${candidate.last_name}`.trim(),
              candidate_email: candidate.work_email,
              candidate_phone: candidate.work_phone,
              candidate_specialty: candidate.specialty,
              candidate_state: candidate.state,
              status: 'pending',
              tier: 2, // B-tier for Alpha Sophia candidates
              match_reasons: ['Alpha Sophia external match'],
            });

          if (leadError) {
            console.error(`Error adding lead for ${importedId}:`, leadError);
          }
        }
      } else {
        // Regular database candidate - just add to campaign
        const { error: leadError } = await supabase
          .from('campaign_leads_v2')
          .insert({
            campaign_id,
            candidate_id: candidate.id,
            candidate_name: `${candidate.first_name} ${candidate.last_name}`.trim(),
            candidate_email: candidate.work_email,
            candidate_phone: candidate.work_phone,
            candidate_specialty: candidate.specialty,
            candidate_state: candidate.state,
            status: 'pending',
          });

        if (leadError) {
          // Might already exist
          if (!leadError.message.includes('duplicate')) {
            console.error(`Error adding lead for ${candidate.id}:`, leadError);
            skippedIds.push(candidate.id);
            continue;
          }
        }
        
        importedIds.push(candidate.id);
      }
    }

    // Track Alpha Sophia imports if any
    if (alphaSophiaImported > 0 && user_id) {
      await supabase.rpc('track_alpha_sophia_usage', {
        p_user_id: user_id,
        p_job_id: job_id || null,
        p_campaign_id: campaign_id,
        p_search_type: 'import',
        p_results_count: 0,
        p_imports_count: alphaSophiaImported,
      });
    }

    // Update campaign leads count
    const { count } = await supabase
      .from('campaign_leads_v2')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id);

    await supabase
      .from('campaigns')
      .update({ leads_count: count || 0 })
      .eq('id', campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedIds.length,
        skipped: skippedIds.length,
        alpha_sophia_imported: alphaSophiaImported,
        campaign_leads_count: count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import candidates error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});