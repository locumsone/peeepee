-- Add all 8 Twilio numbers to the active sender pool
-- Using ON CONFLICT to handle existing numbers

INSERT INTO telnyx_numbers (phone_number, status, daily_limit, messages_sent_today)
VALUES 
  ('+13156286717', 'active', 200, 0),  -- Theresa, NY
  ('+13366562867', 'active', 200, 0),  -- Monticello, NC
  ('+13466562867', 'active', 200, 0),  -- Houston, TX
  ('+12185628671', 'active', 200, 0),  -- Breezy Point, MN
  ('+17163562867', 'active', 200, 0),  -- Randolph, NY
  ('+17756286710', 'active', 200, 0),  -- Dyer, NV
  ('+15715562867', 'active', 200, 0),  -- Virginia
  ('+14355628671', 'active', 200, 0)   -- Salina, UT
ON CONFLICT (phone_number) DO UPDATE SET 
  status = 'active', 
  daily_limit = 200;