-- Delete demo SMS messages first (foreign key constraint)
DELETE FROM sms_messages 
WHERE conversation_id IN (
  SELECT id FROM sms_conversations 
  WHERE candidate_phone IN ('+15551234567', '+15559876543')
);

-- Delete demo SMS conversations
DELETE FROM sms_conversations 
WHERE candidate_phone IN ('+15551234567', '+15559876543');