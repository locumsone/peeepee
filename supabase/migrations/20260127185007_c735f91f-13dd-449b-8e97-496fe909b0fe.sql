
-- Fix the calculate_enrichment_tier trigger to preserve PDL/Whitepages sources
CREATE OR REPLACE FUNCTION public.calculate_enrichment_tier()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    score INTEGER := 0;
    external_sources TEXT[] := ARRAY['PDL', 'Whitepages', 'PeopleDataLabs'];
BEGIN
    -- If this is an UPDATE and the source is being set to an external enrichment provider,
    -- preserve that source and set to Platinum tier
    IF TG_OP = 'UPDATE' AND NEW.enrichment_source = ANY(external_sources) THEN
        NEW.enrichment_tier := 'Platinum';
        NEW.enrichment_needed := false;
        -- Keep the source as-is (PDL or Whitepages)
        RETURN NEW;
    END IF;

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

    -- Assign tier - but only if not already set by external source
    IF NEW.enrichment_source IS NULL OR NOT (NEW.enrichment_source = ANY(external_sources)) THEN
        IF score >= 80 THEN
            NEW.enrichment_tier := 'Platinum';
            NEW.enrichment_source := COALESCE(NEW.enrichment_source, 'Salesforce');
        ELSIF score >= 60 THEN
            NEW.enrichment_tier := 'Gold';
            IF NEW.company_name IS NOT NULL THEN
                NEW.enrichment_source := COALESCE(NEW.enrichment_source, 'Alpha Sophia');
            END IF;
        ELSIF score >= 40 THEN
            NEW.enrichment_tier := 'Silver';
            NEW.enrichment_source := COALESCE(NEW.enrichment_source, 'Crelate');
        ELSIF score >= 20 THEN
            NEW.enrichment_tier := 'Bronze';
            NEW.enrichment_source := COALESCE(NEW.enrichment_source, 'CureHire');
        ELSE
            NEW.enrichment_tier := 'Basic';
        END IF;
    END IF;

    -- Set flags
    NEW.has_credential_data := (NEW.licenses IS NOT NULL OR NEW.board_certifications IS NOT NULL);
    NEW.has_preferences_data := (NEW.desired_states IS NOT NULL OR NEW.shift_preferences IS NOT NULL);
    NEW.has_company_data := (NEW.company_name IS NOT NULL);
    NEW.enrichment_needed := (score < 60) AND (NEW.personal_email IS NULL AND NEW.personal_mobile IS NULL);

    RETURN NEW;
END;
$function$;
