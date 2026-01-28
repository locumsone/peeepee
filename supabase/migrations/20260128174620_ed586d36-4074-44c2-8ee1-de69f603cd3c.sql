-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create job_notes table for internal job notes
CREATE TABLE public.job_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient job-based queries
CREATE INDEX idx_job_notes_job_id ON public.job_notes(job_id);
CREATE INDEX idx_job_notes_created_at ON public.job_notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view notes for any job
CREATE POLICY "Authenticated users can view job notes"
ON public.job_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can create notes
CREATE POLICY "Authenticated users can create job notes"
ON public.job_notes
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Users can update their own notes
CREATE POLICY "Users can update own job notes"
ON public.job_notes
FOR UPDATE
USING (auth.uid() = created_by);

-- Users can delete their own notes, admins can delete any
CREATE POLICY "Users can delete own notes"
ON public.job_notes
FOR DELETE
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_notes_updated_at
BEFORE UPDATE ON public.job_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();