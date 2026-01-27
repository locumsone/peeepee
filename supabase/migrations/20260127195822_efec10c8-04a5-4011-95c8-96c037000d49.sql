-- Enable RLS policies for campaign_leads_v2 table
-- This table is used to track candidates in campaigns for the ATS pipeline

-- Policy for authenticated users to view all campaign leads
CREATE POLICY "Authenticated users can view campaign_leads_v2"
ON public.campaign_leads_v2
FOR SELECT
TO authenticated
USING (true);

-- Policy for authenticated users to insert campaign leads
CREATE POLICY "Authenticated users can insert campaign_leads_v2"
ON public.campaign_leads_v2
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for authenticated users to update campaign leads (for status changes in kanban)
CREATE POLICY "Authenticated users can update campaign_leads_v2"
ON public.campaign_leads_v2
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy for service role to have full access (for edge functions)
CREATE POLICY "Service role full access campaign_leads_v2"
ON public.campaign_leads_v2
FOR ALL
USING (auth.role() = 'service_role');

-- Enable RLS on the table
ALTER TABLE public.campaign_leads_v2 ENABLE ROW LEVEL SECURITY;