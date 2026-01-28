-- Update one conversation to remove candidate_replied flag to test dynamic count
UPDATE sms_conversations 
SET candidate_replied = false 
WHERE id = '957a0dbf-c4c1-47b7-b774-172666347078';