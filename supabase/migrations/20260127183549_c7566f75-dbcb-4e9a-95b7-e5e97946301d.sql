-- Function to get accurate candidate counts by state for specialty matching
CREATE OR REPLACE FUNCTION get_candidate_counts_by_state(
  p_specialty TEXT,
  p_job_state TEXT
)
RETURNS TABLE(local_count INTEGER, other_count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE c.state = p_job_state)::INTEGER AS local_count,
    COUNT(*) FILTER (WHERE c.state != p_job_state OR c.state IS NULL)::INTEGER AS other_count
  FROM candidates c
  WHERE LOWER(TRIM(c.specialty)) = LOWER(TRIM(p_specialty))
     OR c.specialty ILIKE '%' || p_specialty || '%';
END;
$$;