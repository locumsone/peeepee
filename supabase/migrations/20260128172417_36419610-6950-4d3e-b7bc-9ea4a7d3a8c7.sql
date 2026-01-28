-- Create SMS send settings table for rate limiting configuration
CREATE TABLE public.sms_send_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  messages_per_minute INTEGER NOT NULL DEFAULT 30,
  messages_per_hour INTEGER NOT NULL DEFAULT 500,
  messages_per_day INTEGER NOT NULL DEFAULT 2000,
  batch_size INTEGER NOT NULL DEFAULT 50,
  delay_between_batches_seconds INTEGER NOT NULL DEFAULT 60,
  delay_between_messages_ms INTEGER NOT NULL DEFAULT 2000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Insert default settings (conservative to avoid carrier spam)
-- 30 msgs/min = 1 every 2 seconds, spreads 1800 msgs over an hour
INSERT INTO public.sms_send_settings (
  messages_per_minute,
  messages_per_hour,
  messages_per_day,
  batch_size,
  delay_between_batches_seconds,
  delay_between_messages_ms
) VALUES (30, 500, 2000, 50, 60, 2000);

-- Enable RLS on settings
ALTER TABLE public.sms_send_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sms_send_settings"
ON public.sms_send_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update sms_send_settings"
ON public.sms_send_settings FOR UPDATE
TO authenticated
USING (true);

-- Add missing columns to sms_queue if not exist
ALTER TABLE public.sms_queue 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS twilio_sid TEXT,
ADD COLUMN IF NOT EXISTS from_number TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

-- Add tracking columns to campaigns for queue status
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS sms_queued INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_processing INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_failed INTEGER DEFAULT 0;

-- Create index for efficient queue processing if not exists
CREATE INDEX IF NOT EXISTS idx_sms_queue_pending_status 
ON public.sms_queue (scheduled_for, priority DESC) 
WHERE status = 'pending';