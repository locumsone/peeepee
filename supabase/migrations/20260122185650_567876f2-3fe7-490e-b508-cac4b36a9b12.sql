-- Create table to persist candidate research results
CREATE TABLE public.candidate_research (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    
    -- NPI Verification
    npi VARCHAR(20),
    npi_verified BOOLEAN DEFAULT FALSE,
    npi_verification_date TIMESTAMP WITH TIME ZONE,
    
    -- License Analysis
    verified_licenses TEXT[],
    has_imlc BOOLEAN DEFAULT FALSE,
    imlc_inference_reason TEXT,
    license_count INTEGER DEFAULT 0,
    
    -- AI Match Analysis (job-agnostic insights)
    specialty_verified BOOLEAN DEFAULT FALSE,
    verified_specialty TEXT,
    credentials_summary TEXT,
    professional_highlights TEXT[],
    
    -- Research metadata
    research_source TEXT DEFAULT 'npi_registry',
    research_confidence TEXT CHECK (research_confidence IN ('high', 'medium', 'low')),
    last_researched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    researched_by UUID,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint - one research record per candidate
    CONSTRAINT unique_candidate_research UNIQUE (candidate_id)
);

-- Create table for job-specific match scores
CREATE TABLE public.candidate_job_matches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    research_id UUID REFERENCES public.candidate_research(id) ON DELETE SET NULL,
    
    -- Match scoring
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    match_grade VARCHAR(3) CHECK (match_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')),
    
    -- Match details
    match_reasons TEXT[],
    match_concerns TEXT[],
    talking_points TEXT[],
    icebreaker TEXT,
    
    -- License fit
    has_required_license BOOLEAN DEFAULT FALSE,
    license_path TEXT, -- e.g., "direct", "imlc", "willing_to_license"
    
    -- Timestamps
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint - one match record per candidate+job pair
    CONSTRAINT unique_candidate_job_match UNIQUE (candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.candidate_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_job_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidate_research
CREATE POLICY "Anyone can view research" ON public.candidate_research
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert research" ON public.candidate_research
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update research" ON public.candidate_research
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for candidate_job_matches
CREATE POLICY "Anyone can view matches" ON public.candidate_job_matches
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert matches" ON public.candidate_job_matches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update matches" ON public.candidate_job_matches
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Indexes for fast lookups
CREATE INDEX idx_candidate_research_candidate_id ON public.candidate_research(candidate_id);
CREATE INDEX idx_candidate_research_npi ON public.candidate_research(npi) WHERE npi IS NOT NULL;
CREATE INDEX idx_candidate_job_matches_candidate ON public.candidate_job_matches(candidate_id);
CREATE INDEX idx_candidate_job_matches_job ON public.candidate_job_matches(job_id);
CREATE INDEX idx_candidate_job_matches_score ON public.candidate_job_matches(match_score DESC);

-- Trigger for updated_at
CREATE TRIGGER update_candidate_research_updated_at
    BEFORE UPDATE ON public.candidate_research
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_candidate_job_matches_updated_at
    BEFORE UPDATE ON public.candidate_job_matches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to upsert research and return the ID
CREATE OR REPLACE FUNCTION public.upsert_candidate_research(
    p_candidate_id UUID,
    p_npi TEXT DEFAULT NULL,
    p_npi_verified BOOLEAN DEFAULT FALSE,
    p_verified_licenses TEXT[] DEFAULT NULL,
    p_has_imlc BOOLEAN DEFAULT FALSE,
    p_imlc_reason TEXT DEFAULT NULL,
    p_specialty_verified BOOLEAN DEFAULT FALSE,
    p_verified_specialty TEXT DEFAULT NULL,
    p_credentials_summary TEXT DEFAULT NULL,
    p_professional_highlights TEXT[] DEFAULT NULL,
    p_research_confidence TEXT DEFAULT 'medium',
    p_researched_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_research_id UUID;
BEGIN
    INSERT INTO candidate_research (
        candidate_id, npi, npi_verified, npi_verification_date,
        verified_licenses, has_imlc, imlc_inference_reason,
        license_count, specialty_verified, verified_specialty,
        credentials_summary, professional_highlights,
        research_confidence, researched_by, last_researched_at
    ) VALUES (
        p_candidate_id, p_npi, p_npi_verified, 
        CASE WHEN p_npi_verified THEN NOW() ELSE NULL END,
        p_verified_licenses, p_has_imlc, p_imlc_reason,
        COALESCE(array_length(p_verified_licenses, 1), 0),
        p_specialty_verified, p_verified_specialty,
        p_credentials_summary, p_professional_highlights,
        p_research_confidence, p_researched_by, NOW()
    )
    ON CONFLICT (candidate_id) DO UPDATE SET
        npi = COALESCE(EXCLUDED.npi, candidate_research.npi),
        npi_verified = EXCLUDED.npi_verified OR candidate_research.npi_verified,
        npi_verification_date = CASE WHEN EXCLUDED.npi_verified THEN NOW() ELSE candidate_research.npi_verification_date END,
        verified_licenses = COALESCE(EXCLUDED.verified_licenses, candidate_research.verified_licenses),
        has_imlc = EXCLUDED.has_imlc OR candidate_research.has_imlc,
        imlc_inference_reason = COALESCE(EXCLUDED.imlc_inference_reason, candidate_research.imlc_inference_reason),
        license_count = COALESCE(array_length(EXCLUDED.verified_licenses, 1), candidate_research.license_count),
        specialty_verified = EXCLUDED.specialty_verified OR candidate_research.specialty_verified,
        verified_specialty = COALESCE(EXCLUDED.verified_specialty, candidate_research.verified_specialty),
        credentials_summary = COALESCE(EXCLUDED.credentials_summary, candidate_research.credentials_summary),
        professional_highlights = COALESCE(EXCLUDED.professional_highlights, candidate_research.professional_highlights),
        research_confidence = EXCLUDED.research_confidence,
        last_researched_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_research_id;
    
    RETURN v_research_id;
END;
$$;

-- Function to upsert job match
CREATE OR REPLACE FUNCTION public.upsert_candidate_job_match(
    p_candidate_id UUID,
    p_job_id UUID,
    p_research_id UUID DEFAULT NULL,
    p_match_score INTEGER DEFAULT NULL,
    p_match_grade TEXT DEFAULT NULL,
    p_match_reasons TEXT[] DEFAULT NULL,
    p_match_concerns TEXT[] DEFAULT NULL,
    p_talking_points TEXT[] DEFAULT NULL,
    p_icebreaker TEXT DEFAULT NULL,
    p_has_required_license BOOLEAN DEFAULT FALSE,
    p_license_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_id UUID;
BEGIN
    INSERT INTO candidate_job_matches (
        candidate_id, job_id, research_id, match_score, match_grade,
        match_reasons, match_concerns, talking_points, icebreaker,
        has_required_license, license_path, scored_at
    ) VALUES (
        p_candidate_id, p_job_id, p_research_id, p_match_score, p_match_grade,
        p_match_reasons, p_match_concerns, p_talking_points, p_icebreaker,
        p_has_required_license, p_license_path, NOW()
    )
    ON CONFLICT (candidate_id, job_id) DO UPDATE SET
        research_id = COALESCE(EXCLUDED.research_id, candidate_job_matches.research_id),
        match_score = EXCLUDED.match_score,
        match_grade = EXCLUDED.match_grade,
        match_reasons = EXCLUDED.match_reasons,
        match_concerns = EXCLUDED.match_concerns,
        talking_points = EXCLUDED.talking_points,
        icebreaker = EXCLUDED.icebreaker,
        has_required_license = EXCLUDED.has_required_license,
        license_path = EXCLUDED.license_path,
        scored_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_match_id;
    
    RETURN v_match_id;
END;
$$;