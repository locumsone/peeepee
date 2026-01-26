-- Allow authenticated users to insert call logs
CREATE POLICY "Authenticated users can insert ai_call_logs"
ON public.ai_call_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update their call logs
CREATE POLICY "Authenticated users can update ai_call_logs"
ON public.ai_call_logs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);