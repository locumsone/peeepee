-- Add unique constraint on campaign_leads_v2 for upsert operations
ALTER TABLE campaign_leads_v2 
ADD CONSTRAINT campaign_leads_v2_campaign_candidate_unique 
UNIQUE (campaign_id, candidate_id);