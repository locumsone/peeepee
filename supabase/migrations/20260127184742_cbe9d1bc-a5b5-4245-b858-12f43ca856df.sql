-- Create RPC function to properly update enrichment data
CREATE OR REPLACE FUNCTION update_candidate_enrichment(
  p_candidate_id UUID,
  p_personal_email TEXT DEFAULT NULL,
  p_personal_mobile TEXT DEFAULT NULL,
  p_enrichment_source TEXT DEFAULT NULL,
  p_enrichment_tier TEXT DEFAULT 'Platinum'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE candidates
  SET 
    personal_email = COALESCE(p_personal_email, personal_email),
    personal_mobile = COALESCE(p_personal_mobile, personal_mobile),
    enrichment_source = COALESCE(p_enrichment_source, enrichment_source),
    enrichment_tier = COALESCE(p_enrichment_tier, enrichment_tier),
    enriched_at = NOW(),
    enrichment_needed = false,
    last_enrichment_date = NOW()::date
  WHERE id = p_candidate_id;
END;
$$;