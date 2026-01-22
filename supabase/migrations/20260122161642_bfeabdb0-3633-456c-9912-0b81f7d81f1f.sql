-- Enable RLS on the final 2 tables that have policies but RLS is disabled
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;