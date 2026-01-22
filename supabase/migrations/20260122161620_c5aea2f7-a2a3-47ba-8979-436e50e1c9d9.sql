-- Add remaining policies (skip existing ones)
DROP POLICY IF EXISTS "Authenticated users can view enrichment_queue" ON enrichment_queue;
CREATE POLICY "Authenticated users can view enrichment_queue" ON enrichment_queue FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view candidate_outreach_log" ON candidate_outreach_log;
CREATE POLICY "Authenticated users can view candidate_outreach_log" ON candidate_outreach_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view agent_prompts" ON agent_prompts;
CREATE POLICY "Authenticated users can view agent_prompts" ON agent_prompts FOR SELECT TO authenticated USING (true);

-- Drop security definer views
DROP VIEW IF EXISTS sms_inbox;
DROP VIEW IF EXISTS v_calls_ready_to_dial;
DROP VIEW IF EXISTS v_todays_call_stats;
DROP VIEW IF EXISTS v_upcoming_callbacks;
DROP VIEW IF EXISTS ai_call_queue_status;
DROP VIEW IF EXISTS enrichment_costs;