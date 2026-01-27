-- Fix the existing enriched candidates from the Lakewood batch
-- Set contact_enrichment_source to 'PDL' for records that have personal contact info from enrichment logs
UPDATE public.candidates c
SET 
  contact_enrichment_source = 'PDL',
  contact_enriched_at = el.created_at,
  enrichment_tier = 'Platinum'
FROM enrichment_log el
WHERE el.candidate_id = c.id
  AND el.source = 'pdl'
  AND c.contact_enrichment_source IS NULL
  AND (c.personal_mobile IS NOT NULL OR c.personal_email IS NOT NULL);