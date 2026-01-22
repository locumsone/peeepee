-- ===========================================
-- SECURITY FIX: Enable RLS and restrict access
-- ===========================================

-- 1. Enable RLS on all tables that need it
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_budget ENABLE ROW LEVEL SECURITY;

-- 2. Drop overly permissive policies (that still exist)
DROP POLICY IF EXISTS "Anyone can read messages" ON sms_messages;
DROP POLICY IF EXISTS "Anyone can read conversations" ON sms_conversations;
DROP POLICY IF EXISTS "Anyone can read telnyx numbers" ON telnyx_numbers;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Allow read access" ON enrichment_budget;
DROP POLICY IF EXISTS "Allow read access" ON enrichment_log;

-- 3. Create secure authenticated-only policies (only for those that don't exist)

-- SMS Messages: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view sms_messages" ON sms_messages;
CREATE POLICY "Authenticated users can view sms_messages"
  ON sms_messages FOR SELECT
  TO authenticated
  USING (true);

-- SMS Conversations: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view sms_conversations" ON sms_conversations;
CREATE POLICY "Authenticated users can view sms_conversations"
  ON sms_conversations FOR SELECT
  TO authenticated
  USING (true);

-- Telnyx Numbers: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view telnyx_numbers" ON telnyx_numbers;
CREATE POLICY "Authenticated users can view telnyx_numbers"
  ON telnyx_numbers FOR SELECT
  TO authenticated
  USING (true);

-- Users: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view users" ON users;
CREATE POLICY "Authenticated users can view users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Enrichment Budget: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view enrichment_budget" ON enrichment_budget;
CREATE POLICY "Authenticated users can view enrichment_budget"
  ON enrichment_budget FOR SELECT
  TO authenticated
  USING (true);

-- Enrichment Log: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view enrichment_log" ON enrichment_log;
CREATE POLICY "Authenticated users can view enrichment_log"
  ON enrichment_log FOR SELECT
  TO authenticated
  USING (true);

-- Recruiters: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view recruiters" ON recruiters;
CREATE POLICY "Authenticated users can view recruiters"
  ON recruiters FOR SELECT
  TO authenticated
  USING (true);

-- Email Templates: Only authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view email_templates" ON email_templates;
CREATE POLICY "Authenticated users can view email_templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (true);