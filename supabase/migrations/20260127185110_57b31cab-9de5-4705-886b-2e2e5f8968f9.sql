-- Add a separate column for contact enrichment source
-- This keeps track of PDL/Whitepages separately from the original data source (Crelate, CureHire, etc.)

ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS contact_enrichment_source TEXT,
ADD COLUMN IF NOT EXISTS contact_enriched_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.candidates.contact_enrichment_source IS 'Source of personal contact enrichment (PDL, Whitepages) - separate from original data source';
COMMENT ON COLUMN public.candidates.contact_enriched_at IS 'When personal contact info was enriched';

-- Update the trigger to NOT overwrite enrichment_source anymore
-- Just update the contact-specific columns
CREATE OR REPLACE FUNCTION public.calculate_enrichment_tier()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Core identity
    IF NEW.npi IS NOT NULL THEN score := score + 10; END IF;
    IF NEW.email IS NOT NULL THEN score := score + 10; END IF;
    IF NEW.phone IS NOT NULL THEN score := score + 10; END IF;

    -- Credentials
    IF NEW.specialty IS NOT NULL THEN score := score + 5; END IF;
    IF NEW.licenses IS NOT NULL AND array_length(NEW.licenses, 1) > 0 THEN score := score + 10; END IF;
    IF NEW.board_certified = TRUE THEN score := score + 5; END IF;

    -- Preferences (indicates enrichment from Salesforce)
    IF NEW.desired_states IS NOT NULL AND array_length(NEW.desired_states, 1) > 0 THEN score := score + 10; END IF;
    IF NEW.shift_preferences IS NOT NULL AND array_length(NEW.shift_preferences, 1) > 0 THEN score := score + 5; END IF;
    IF NEW.desired_hourly_max IS NOT NULL THEN score := score + 5; END IF;

    -- Company data (indicates Alpha Sophia enrichment)
    IF NEW.company_name IS NOT NULL THEN score := score + 10; END IF;

    -- Work experience
    IF NEW.years_of_experience IS NOT NULL THEN score := score + 5; END IF;

    -- Personal contact info from enrichment (boost score significantly)
    IF NEW.personal_email IS NOT NULL OR NEW.personal_mobile IS NOT NULL THEN 
        score := score + 20; 
    END IF;

    NEW.enrichment_score := score;

    -- Assign tier based on score
    IF score >= 80 THEN
        NEW.enrichment_tier := 'Platinum';
    ELSIF score >= 60 THEN
        NEW.enrichment_tier := 'Gold';
    ELSIF score >= 40 THEN
        NEW.enrichment_tier := 'Silver';
    ELSIF score >= 20 THEN
        NEW.enrichment_tier := 'Bronze';
    ELSE
        NEW.enrichment_tier := 'Basic';
    END IF;

    -- Auto-upgrade to Platinum if has personal contact info
    IF NEW.personal_email IS NOT NULL OR NEW.personal_mobile IS NOT NULL THEN
        NEW.enrichment_tier := 'Platinum';
    END IF;

    -- Set flags
    NEW.has_credential_data := (NEW.licenses IS NOT NULL OR NEW.board_certifications IS NOT NULL);
    NEW.has_preferences_data := (NEW.desired_states IS NOT NULL OR NEW.shift_preferences IS NOT NULL);
    NEW.has_company_data := (NEW.company_name IS NOT NULL);
    NEW.enrichment_needed := (score < 60) AND (NEW.personal_email IS NULL AND NEW.personal_mobile IS NULL);

    -- DO NOT touch enrichment_source - preserve the original data source (Crelate, CureHire, Alpha Sophia)
    -- contact_enrichment_source is set separately by the enrich-contact function

    RETURN NEW;
END;
$function$;

-- Update the RPC function to use the new columns
CREATE OR REPLACE FUNCTION public.update_candidate_enrichment(
    p_candidate_id UUID,
    p_personal_email TEXT DEFAULT NULL,
    p_personal_mobile TEXT DEFAULT NULL,
    p_enrichment_source TEXT DEFAULT NULL,
    p_enrichment_tier TEXT DEFAULT 'Platinum'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.candidates
    SET 
        personal_email = COALESCE(p_personal_email, personal_email),
        personal_mobile = COALESCE(p_personal_mobile, personal_mobile),
        contact_enrichment_source = COALESCE(p_enrichment_source, contact_enrichment_source),
        contact_enriched_at = NOW(),
        enriched_at = NOW(),
        enrichment_needed = false
    WHERE id = p_candidate_id;
END;
$$;