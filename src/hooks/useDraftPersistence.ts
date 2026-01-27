import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SelectedCandidate } from "@/components/campaign-review/types";

interface DraftData {
  jobId: string | null;
  candidates: SelectedCandidate[];
  campaignName: string;
  databaseCampaignId?: string | null;
}

/**
 * Hook to persist campaign drafts to the database.
 * Syncs candidates to campaign_leads_v2 immediately so data isn't lost on browser close.
 */
export function useDraftPersistence() {
  const lastPersistRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Persist draft campaign and candidates to the database.
   * Creates/updates a campaign with status="draft" and upserts campaign_leads_v2 records.
   */
  const persistToDatabase = useCallback(async (draft: DraftData): Promise<string | null> => {
    if (!draft.jobId || draft.candidates.length === 0) {
      return null;
    }

    // Create a signature to avoid duplicate writes
    const signature = `${draft.jobId}-${draft.candidates.length}-${draft.candidates.map(c => c.id).join(",")}`;
    if (signature === lastPersistRef.current) {
      return draft.databaseCampaignId || null;
    }

    try {
      // Upsert campaign record with draft status
      let campaignId = draft.databaseCampaignId;
      
      if (campaignId) {
        // Update existing draft campaign
        const { error: updateError } = await supabase
          .from("campaigns")
          .update({
            name: draft.campaignName || "Draft Campaign",
            leads_count: draft.candidates.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);
          
        if (updateError) {
          console.error("[useDraftPersistence] Error updating campaign:", updateError);
        }
      } else {
        // Create new draft campaign
        const { data: campaign, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            job_id: draft.jobId,
            name: draft.campaignName || "Draft Campaign",
            status: "draft",
            leads_count: draft.candidates.length,
          })
          .select("id")
          .single();
          
        if (insertError) {
          console.error("[useDraftPersistence] Error creating campaign:", insertError);
          return null;
        }
        
        campaignId = campaign?.id || null;
      }

      if (!campaignId) {
        console.error("[useDraftPersistence] No campaign ID available");
        return null;
      }

      // Upsert campaign_leads_v2 records
      const leads = draft.candidates.map(c => ({
        campaign_id: campaignId,
        candidate_id: c.id,
        candidate_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || null,
        candidate_email: c.email || c.personal_email || null,
        candidate_phone: c.phone || c.personal_mobile || null,
        candidate_specialty: c.specialty || null,
        candidate_state: c.state || null,
        status: "draft",
        tier: c.tier || null,
      }));

      // Use upsert with the new unique constraint
      const { error: leadsError } = await supabase
        .from("campaign_leads_v2")
        .upsert(leads, {
          onConflict: "campaign_id,candidate_id",
          ignoreDuplicates: false,
        });

      if (leadsError) {
        console.error("[useDraftPersistence] Error upserting leads:", leadsError);
      } else {
        console.log(`[useDraftPersistence] Persisted ${leads.length} candidates to campaign ${campaignId}`);
        lastPersistRef.current = signature;
      }

      return campaignId;
    } catch (err) {
      console.error("[useDraftPersistence] Unexpected error:", err);
      return null;
    }
  }, []);

  /**
   * Debounced persist - waits 2 seconds after last change before persisting.
   */
  const debouncedPersist = useCallback((draft: DraftData, onComplete?: (campaignId: string | null) => void) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(async () => {
      const campaignId = await persistToDatabase(draft);
      onComplete?.(campaignId);
    }, 2000);
  }, [persistToDatabase]);

  /**
   * Load draft campaign from database for a given job.
   */
  const loadFromDatabase = useCallback(async (jobId: string): Promise<{
    campaignId: string;
    name: string;
    candidates: Array<{
      id: string;
      candidate_id: string;
      candidate_name: string | null;
      candidate_email: string | null;
      candidate_phone: string | null;
      candidate_specialty: string | null;
      candidate_state: string | null;
      tier: number | null;
      match_score: number | null;
    }>;
  } | null> => {
    try {
      // Find most recent draft campaign for this job
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, name, created_at")
        .eq("job_id", jobId)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignError || !campaign) {
        return null;
      }

      // Fetch campaign leads
      const { data: leads, error: leadsError } = await supabase
        .from("campaign_leads_v2")
        .select("id, candidate_id, candidate_name, candidate_email, candidate_phone, candidate_specialty, candidate_state, tier, match_score")
        .eq("campaign_id", campaign.id)
        .eq("status", "draft");

      if (leadsError) {
        console.error("[useDraftPersistence] Error loading leads:", leadsError);
        return null;
      }

      return {
        campaignId: campaign.id,
        name: campaign.name || "Draft Campaign",
        candidates: leads || [],
      };
    } catch (err) {
      console.error("[useDraftPersistence] Error loading from database:", err);
      return null;
    }
  }, []);

  /**
   * Delete draft leads that are no longer in the candidate list.
   */
  const cleanupRemovedCandidates = useCallback(async (campaignId: string, currentCandidateIds: string[]) => {
    if (!campaignId || currentCandidateIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("campaign_leads_v2")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("status", "draft")
        .not("candidate_id", "in", `(${currentCandidateIds.join(",")})`);

      if (error) {
        console.error("[useDraftPersistence] Error cleaning up removed candidates:", error);
      }
    } catch (err) {
      console.error("[useDraftPersistence] Cleanup error:", err);
    }
  }, []);

  return {
    persistToDatabase,
    debouncedPersist,
    loadFromDatabase,
    cleanupRemovedCandidates,
  };
}
