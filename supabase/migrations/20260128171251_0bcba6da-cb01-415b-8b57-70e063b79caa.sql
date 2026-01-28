-- Create job_assignment_role enum
CREATE TYPE public.job_assignment_role AS ENUM ('primary', 'support');

-- Create job_assignments table
CREATE TABLE public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role job_assignment_role NOT NULL DEFAULT 'support',
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

-- Enable RLS
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view job assignments (team visibility)
CREATE POLICY "Authenticated users can view all job assignments"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own assignments
CREATE POLICY "Users can create own job assignments"
ON public.job_assignments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own assignments
CREATE POLICY "Users can update own job assignments"
ON public.job_assignments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own assignments
CREATE POLICY "Users can delete own job assignments"
ON public.job_assignments
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_job_assignments_job_id ON public.job_assignments(job_id);
CREATE INDEX idx_job_assignments_user_id ON public.job_assignments(user_id);

-- Update sms_conversations RLS to filter by recruiter_id
DROP POLICY IF EXISTS "Authenticated users can view sms_conversations" ON public.sms_conversations;
DROP POLICY IF EXISTS "Users can view sms_conversations" ON public.sms_conversations;

CREATE POLICY "Users view own sms_conversations"
ON public.sms_conversations
FOR SELECT
TO authenticated
USING (recruiter_id = auth.uid() OR recruiter_id IS NULL);

-- Update ai_call_logs RLS to filter by recruiter_id
DROP POLICY IF EXISTS "Authenticated users can view ai_call_logs" ON public.ai_call_logs;
DROP POLICY IF EXISTS "Users can view ai_call_logs" ON public.ai_call_logs;

CREATE POLICY "Users view own ai_call_logs"
ON public.ai_call_logs
FOR SELECT
TO authenticated
USING (recruiter_id::uuid = auth.uid() OR recruiter_id IS NULL);