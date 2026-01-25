-- Add enriched_at timestamp column if not exists
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Update existing enriched candidates to set enriched_at from last_enrichment_date
UPDATE candidates 
SET enriched_at = last_enrichment_date::timestamptz 
WHERE last_enrichment_date IS NOT NULL AND enriched_at IS NULL;