-- Phase 1: Delete demo data from ai_call_logs
DELETE FROM ai_call_logs 
WHERE phone_number IN ('+15551234567', '+15559876543', '+15557890123', 'unknown', '+12185628671')
   OR (status = 'initiated' AND candidate_name = 'Dr. ATLAZ Test')
   OR (status = 'in_progress' AND candidate_name IS NULL);

-- Phase 2 & 3: Add contact_name and reminder columns to sms_conversations
ALTER TABLE sms_conversations 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_note TEXT,
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP WITH TIME ZONE;