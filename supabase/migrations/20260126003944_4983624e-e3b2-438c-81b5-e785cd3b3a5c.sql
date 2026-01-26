-- Add campaign deliverability tracking columns
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_opened INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_clicked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_replied INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_bounced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_delivered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_replied INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_attempted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_connected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create campaign events table for granular tracking
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.campaign_leads_v2(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel TEXT,
  metadata JSONB,
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_id ON public.campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_event_type ON public.campaign_events(event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_events_external_id ON public.campaign_events(external_id);

-- Enable RLS
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Authenticated users can view campaign events"
ON public.campaign_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert campaign events"
ON public.campaign_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create trigger for updated_at on campaigns
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_campaigns_timestamp ON public.campaigns;
CREATE TRIGGER update_campaigns_timestamp
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_campaigns_updated_at();