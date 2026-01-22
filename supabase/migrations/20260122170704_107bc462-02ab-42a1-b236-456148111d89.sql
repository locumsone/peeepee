-- Alpha Sophia configuration and usage tracking

-- Configuration table for Alpha Sophia settings
CREATE TABLE public.alpha_sophia_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    min_local_threshold integer NOT NULL DEFAULT 15,
    max_results_per_search integer NOT NULL DEFAULT 50,
    daily_limit integer NOT NULL DEFAULT 500,
    admin_daily_limit integer NOT NULL DEFAULT 2000,
    cost_per_lookup numeric(10,4) NOT NULL DEFAULT 0.05,
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Insert default config
INSERT INTO public.alpha_sophia_config (min_local_threshold, max_results_per_search, daily_limit, admin_daily_limit)
VALUES (15, 50, 500, 2000);

-- Usage tracking table
CREATE TABLE public.alpha_sophia_usage (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    job_id uuid REFERENCES public.jobs(id),
    campaign_id uuid REFERENCES public.campaigns(id),
    search_type text NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
    specialty_searched text,
    state_searched text,
    results_returned integer NOT NULL DEFAULT 0,
    candidates_imported integer NOT NULL DEFAULT 0,
    estimated_cost numeric(10,4) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Daily usage summary view for quick lookups
CREATE TABLE public.alpha_sophia_daily_usage (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    usage_date date NOT NULL DEFAULT CURRENT_DATE,
    user_id uuid REFERENCES auth.users(id),
    total_searches integer NOT NULL DEFAULT 0,
    total_results integer NOT NULL DEFAULT 0,
    total_imports integer NOT NULL DEFAULT 0,
    total_cost numeric(10,4) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(usage_date, user_id)
);

-- Function to track Alpha Sophia usage
CREATE OR REPLACE FUNCTION public.track_alpha_sophia_usage(
    p_user_id uuid,
    p_job_id uuid DEFAULT NULL,
    p_campaign_id uuid DEFAULT NULL,
    p_search_type text DEFAULT 'auto',
    p_specialty text DEFAULT NULL,
    p_state text DEFAULT NULL,
    p_results_count integer DEFAULT 0,
    p_imports_count integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usage_id uuid;
    v_cost numeric;
    v_config record;
BEGIN
    -- Get current config
    SELECT * INTO v_config FROM alpha_sophia_config LIMIT 1;
    
    -- Calculate cost
    v_cost := p_results_count * COALESCE(v_config.cost_per_lookup, 0.05);
    
    -- Insert usage record
    INSERT INTO alpha_sophia_usage (
        user_id, job_id, campaign_id, search_type,
        specialty_searched, state_searched, results_returned,
        candidates_imported, estimated_cost
    ) VALUES (
        p_user_id, p_job_id, p_campaign_id, p_search_type,
        p_specialty, p_state, p_results_count,
        p_imports_count, v_cost
    )
    RETURNING id INTO v_usage_id;
    
    -- Update daily summary
    INSERT INTO alpha_sophia_daily_usage (usage_date, user_id, total_searches, total_results, total_imports, total_cost)
    VALUES (CURRENT_DATE, p_user_id, 1, p_results_count, p_imports_count, v_cost)
    ON CONFLICT (usage_date, user_id) DO UPDATE SET
        total_searches = alpha_sophia_daily_usage.total_searches + 1,
        total_results = alpha_sophia_daily_usage.total_results + p_results_count,
        total_imports = alpha_sophia_daily_usage.total_imports + p_imports_count,
        total_cost = alpha_sophia_daily_usage.total_cost + v_cost,
        updated_at = NOW();
    
    RETURN v_usage_id;
END;
$$;

-- Function to check if user can use Alpha Sophia (within limits)
CREATE OR REPLACE FUNCTION public.check_alpha_sophia_limit(p_user_id uuid)
RETURNS TABLE(
    allowed boolean,
    remaining integer,
    daily_limit integer,
    used_today integer,
    is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config record;
    v_user_role text;
    v_used_today integer;
    v_limit integer;
BEGIN
    -- Get config
    SELECT * INTO v_config FROM alpha_sophia_config LIMIT 1;
    
    -- Get user role
    SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
    
    -- Determine limit based on role
    IF v_user_role = 'admin' THEN
        v_limit := COALESCE(v_config.admin_daily_limit, 2000);
    ELSE
        v_limit := COALESCE(v_config.daily_limit, 500);
    END IF;
    
    -- Get today's usage
    SELECT COALESCE(SUM(total_results), 0) INTO v_used_today
    FROM alpha_sophia_daily_usage
    WHERE usage_date = CURRENT_DATE AND user_id = p_user_id;
    
    RETURN QUERY SELECT 
        (v_used_today < v_limit) AS allowed,
        (v_limit - v_used_today)::integer AS remaining,
        v_limit AS daily_limit,
        v_used_today AS used_today,
        (v_user_role = 'admin') AS is_admin;
END;
$$;

-- Function to import Alpha Sophia candidate to database
CREATE OR REPLACE FUNCTION public.import_alpha_sophia_candidate(
    p_external_id text,
    p_first_name text,
    p_last_name text,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_specialty text DEFAULT NULL,
    p_city text DEFAULT NULL,
    p_state text DEFAULT NULL,
    p_licenses text[] DEFAULT NULL,
    p_npi text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate_id uuid;
BEGIN
    -- Check if already imported (by NPI or external ID in notes)
    IF p_npi IS NOT NULL THEN
        SELECT id INTO v_candidate_id FROM candidates WHERE npi = p_npi LIMIT 1;
        IF v_candidate_id IS NOT NULL THEN
            RETURN v_candidate_id;
        END IF;
    END IF;
    
    -- Check by external ID in notes
    SELECT id INTO v_candidate_id FROM candidates 
    WHERE notes LIKE '%alpha_sophia_id:' || p_external_id || '%' LIMIT 1;
    IF v_candidate_id IS NOT NULL THEN
        RETURN v_candidate_id;
    END IF;
    
    -- Insert new candidate
    INSERT INTO candidates (
        first_name, last_name, email, phone, specialty,
        city, state, licenses, npi, source, enrichment_tier,
        notes, created_at
    ) VALUES (
        p_first_name, p_last_name, p_email, p_phone, p_specialty,
        p_city, p_state, p_licenses, p_npi, 'alpha_sophia', 'Alpha Sophia',
        'Imported from Alpha Sophia. alpha_sophia_id:' || p_external_id, NOW()
    )
    RETURNING id INTO v_candidate_id;
    
    RETURN v_candidate_id;
END;
$$;

-- Enable RLS
ALTER TABLE public.alpha_sophia_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_sophia_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_sophia_daily_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Config: only admins can modify, all authenticated can read
CREATE POLICY "Authenticated users can view config" ON public.alpha_sophia_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can modify config" ON public.alpha_sophia_config
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Usage: users can view their own, admins can view all
CREATE POLICY "Users can view own usage" ON public.alpha_sophia_usage
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage" ON public.alpha_sophia_usage
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role can insert usage" ON public.alpha_sophia_usage
    FOR INSERT TO authenticated WITH CHECK (true);

-- Daily usage: same as usage
CREATE POLICY "Users can view own daily usage" ON public.alpha_sophia_daily_usage
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all daily usage" ON public.alpha_sophia_daily_usage
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Create indexes for performance
CREATE INDEX idx_alpha_sophia_usage_user_date ON public.alpha_sophia_usage(user_id, created_at);
CREATE INDEX idx_alpha_sophia_usage_job ON public.alpha_sophia_usage(job_id);
CREATE INDEX idx_alpha_sophia_daily_usage_date ON public.alpha_sophia_daily_usage(usage_date);