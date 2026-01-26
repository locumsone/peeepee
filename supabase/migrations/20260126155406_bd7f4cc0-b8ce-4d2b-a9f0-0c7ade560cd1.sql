-- Add missing columns for Twilio SMS tracking
ALTER TABLE public.sms_messages 
ADD COLUMN IF NOT EXISTS twilio_sid text,
ADD COLUMN IF NOT EXISTS from_number text,
ADD COLUMN IF NOT EXISTS to_number text;

-- Create index for faster lookups by twilio_sid
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid ON public.sms_messages(twilio_sid);