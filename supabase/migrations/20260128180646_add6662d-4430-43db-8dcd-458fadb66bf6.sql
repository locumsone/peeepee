-- Create candidate_scorecard_ratings table for persisting evaluations
CREATE TABLE public.candidate_scorecard_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    attribute_id text NOT NULL,
    value jsonb NOT NULL,
    evaluated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(job_id, candidate_id, attribute_id)
);

-- Enable RLS
ALTER TABLE public.candidate_scorecard_ratings ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view scorecard ratings"
ON public.candidate_scorecard_ratings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert scorecard ratings"
ON public.candidate_scorecard_ratings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scorecard ratings"
ON public.candidate_scorecard_ratings
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete own scorecard ratings"
ON public.candidate_scorecard_ratings
FOR DELETE
TO authenticated
USING (evaluated_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for candidate_job_matches (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'candidate_job_matches' 
        AND policyname = 'Authenticated users can delete matches'
    ) THEN
        CREATE POLICY "Authenticated users can delete matches"
        ON public.candidate_job_matches
        FOR DELETE
        TO authenticated
        USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Create indexes
CREATE INDEX idx_scorecard_ratings_job_id ON public.candidate_scorecard_ratings(job_id);
CREATE INDEX idx_scorecard_ratings_candidate_id ON public.candidate_scorecard_ratings(candidate_id);
CREATE INDEX idx_scorecard_ratings_job_candidate ON public.candidate_scorecard_ratings(job_id, candidate_id);

-- Create trigger for updated_at
CREATE TRIGGER update_scorecard_ratings_updated_at
BEFORE UPDATE ON public.candidate_scorecard_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();