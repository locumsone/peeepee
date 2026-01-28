-- Mark all existing numbers as inactive first
UPDATE telnyx_numbers SET status = 'inactive';

-- Update the one we have (+12185628671) to active
UPDATE telnyx_numbers 
SET status = 'active', daily_limit = 200, messages_sent_today = 0
WHERE phone_number = '+12185628671';

-- Insert the second Twilio number if it doesn't exist
INSERT INTO telnyx_numbers (phone_number, status, daily_limit, messages_sent_today)
VALUES ('+14355628671', 'active', 200, 0)
ON CONFLICT (phone_number) DO UPDATE SET status = 'active', daily_limit = 200;