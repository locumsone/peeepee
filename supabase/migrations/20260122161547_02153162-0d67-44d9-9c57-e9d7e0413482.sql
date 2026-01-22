-- Enable RLS on remaining tables with policies but RLS disabled
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;