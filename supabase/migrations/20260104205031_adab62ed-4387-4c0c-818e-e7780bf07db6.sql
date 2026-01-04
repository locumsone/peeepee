-- Insert demo campaign if not exists
INSERT INTO public.campaigns (name, status, job_id, channel, leads_count)
SELECT 'IR - Chippewa Valley Demo', 'active', null, 'all', 5
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'IR - Chippewa Valley Demo');

-- Create demo candidates if they don't exist
INSERT INTO public.candidates (first_name, last_name, phone, specialty, enrichment_tier, email, state)
VALUES 
  ('Sarah', 'Mitchell', '+15551234567', 'Interventional Radiology', 'Gold', 'sarah.mitchell@demo.com', 'WI'),
  ('James', 'Chen', '+15559876543', 'Interventional Radiology', 'Silver', 'james.chen@demo.com', 'MN')
ON CONFLICT DO NOTHING;

-- Insert demo SMS conversations with proper foreign key references
DO $$
DECLARE
  v_atlaz_id uuid;
  v_sarah_id uuid;
  v_james_id uuid;
  v_conv1_id uuid;
  v_conv2_id uuid;
  v_conv3_id uuid;
  v_campaign_id uuid;
BEGIN
  -- Get candidate IDs
  SELECT id INTO v_atlaz_id FROM public.candidates WHERE phone = '+16784675978' LIMIT 1;
  SELECT id INTO v_sarah_id FROM public.candidates WHERE phone = '+15551234567' LIMIT 1;
  SELECT id INTO v_james_id FROM public.candidates WHERE phone = '+15559876543' LIMIT 1;
  SELECT id INTO v_campaign_id FROM public.campaigns WHERE name = 'IR - Chippewa Valley Demo' LIMIT 1;

  -- Update existing ATLAZ conversation or insert new one
  INSERT INTO public.sms_conversations (
    candidate_id, candidate_phone, telnyx_number, campaign_id, status, 
    last_message_at, last_message_preview, last_message_direction,
    unread_count, total_messages, candidate_replied, interest_detected
  ) VALUES (
    v_atlaz_id, '+16784675978', '+12185628671', v_campaign_id, 'active',
    NOW() - INTERVAL '2 hours', 'Yes I am interested! When can we talk?', 'inbound',
    1, 2, true, true
  )
  ON CONFLICT (candidate_phone, telnyx_number) DO UPDATE SET
    last_message_at = NOW() - INTERVAL '2 hours',
    last_message_preview = 'Yes I am interested! When can we talk?',
    unread_count = 1,
    candidate_replied = true,
    interest_detected = true
  RETURNING id INTO v_conv1_id;

  -- Insert Sarah's conversation
  IF v_sarah_id IS NOT NULL THEN
    INSERT INTO public.sms_conversations (
      candidate_id, candidate_phone, telnyx_number, campaign_id, status,
      last_message_at, last_message_preview, last_message_direction,
      unread_count, total_messages, candidate_replied
    ) VALUES (
      v_sarah_id, '+15551234567', '+12185628671', v_campaign_id, 'active',
      NOW() - INTERVAL '1 day', 'Thanks for reaching out. What is the pay rate?', 'inbound',
      0, 3, true
    )
    ON CONFLICT (candidate_phone, telnyx_number) DO UPDATE SET
      last_message_at = NOW() - INTERVAL '1 day',
      last_message_preview = 'Thanks for reaching out. What is the pay rate?'
    RETURNING id INTO v_conv2_id;
  END IF;

  -- Insert James's conversation
  IF v_james_id IS NOT NULL THEN
    INSERT INTO public.sms_conversations (
      candidate_id, candidate_phone, telnyx_number, campaign_id, status,
      last_message_at, last_message_preview, last_message_direction,
      unread_count, total_messages, candidate_replied
    ) VALUES (
      v_james_id, '+15559876543', '+12185628671', v_campaign_id, 'active',
      NOW() - INTERVAL '3 days', 'Not available until March', 'inbound',
      0, 2, true
    )
    ON CONFLICT (candidate_phone, telnyx_number) DO UPDATE SET
      last_message_at = NOW() - INTERVAL '3 days',
      last_message_preview = 'Not available until March'
    RETURNING id INTO v_conv3_id;
  END IF;

  -- Get conversation IDs for message insertion
  IF v_conv1_id IS NULL THEN
    SELECT id INTO v_conv1_id FROM public.sms_conversations WHERE candidate_phone = '+16784675978' LIMIT 1;
  END IF;
  IF v_conv2_id IS NULL THEN
    SELECT id INTO v_conv2_id FROM public.sms_conversations WHERE candidate_phone = '+15551234567' LIMIT 1;
  END IF;
  IF v_conv3_id IS NULL THEN
    SELECT id INTO v_conv3_id FROM public.sms_conversations WHERE candidate_phone = '+15559876543' LIMIT 1;
  END IF;

  -- Insert messages for ATLAZ conversation
  IF v_conv1_id IS NOT NULL THEN
    INSERT INTO public.sms_messages (conversation_id, direction, body, status, sent_at, created_at)
    VALUES 
      (v_conv1_id, 'outbound', 'Hi Dr. Test! We have an IR opportunity in Wisconsin at $474/hr. Are you interested in learning more?', 'delivered', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
      (v_conv1_id, 'inbound', 'Yes I am interested! When can we talk?', 'received', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert messages for Sarah's conversation
  IF v_conv2_id IS NOT NULL THEN
    INSERT INTO public.sms_messages (conversation_id, direction, body, status, sent_at, created_at)
    VALUES 
      (v_conv2_id, 'outbound', 'Hi Dr. Mitchell! I have a locum IR position in Eau Claire, WI. Schedule is 7on/7off. Would this interest you?', 'delivered', NOW() - INTERVAL '1 day' - INTERVAL '2 hours', NOW() - INTERVAL '1 day' - INTERVAL '2 hours'),
      (v_conv2_id, 'inbound', 'Thanks for reaching out. What is the pay rate?', 'received', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
      (v_conv2_id, 'outbound', 'The pay rate is $474/hour with travel and lodging covered. Want me to send more details?', 'delivered', NOW() - INTERVAL '23 hours', NOW() - INTERVAL '23 hours')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert messages for James's conversation
  IF v_conv3_id IS NOT NULL THEN
    INSERT INTO public.sms_messages (conversation_id, direction, body, status, sent_at, created_at)
    VALUES 
      (v_conv3_id, 'outbound', 'Hi Dr. Chen! We have an IR opportunity in Wisconsin starting next month. Are you available?', 'delivered', NOW() - INTERVAL '3 days' - INTERVAL '1 hour', NOW() - INTERVAL '3 days' - INTERVAL '1 hour'),
      (v_conv3_id, 'inbound', 'Not available until March', 'received', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Insert demo AI call logs
INSERT INTO public.ai_call_logs (
  candidate_name, phone_number, status, call_result, duration_seconds, 
  transcript_text, created_at, from_number, call_type, human_detected
)
SELECT 
  'Sarah Mitchell', '+15551234567', 'completed', 'interested', 142,
  'AI: Hi, this is ARIA from Locums One calling about an interventional radiology opportunity. Is this Dr. Mitchell?
Candidate: Yes, this is she.
AI: Great! We have a fantastic locum position in Eau Claire, Wisconsin paying $474 per hour with a 7 on 7 off schedule. Does this sound like something you would be interested in?
Candidate: Yes I would be interested in learning more about that opportunity. What are the dates?
AI: The position starts in mid-January and runs through March. Would you like me to have one of our recruiters reach out with more details?
Candidate: Yes please, that would be great.
AI: Perfect! I will have someone from our team contact you within the next business day. Is this the best number to reach you?
Candidate: Yes it is.
AI: Wonderful. Thank you for your time Dr. Mitchell. Have a great day!',
  NOW() - INTERVAL '1 day', '+12185628671', 'ai', true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_logs WHERE phone_number = '+15551234567' AND call_result = 'interested'
);

INSERT INTO public.ai_call_logs (
  candidate_name, phone_number, status, call_result, duration_seconds,
  transcript_text, created_at, from_number, call_type
)
SELECT 
  'James Chen', '+15559876543', 'completed', 'callback_requested', 89,
  'AI: Hi, this is ARIA from Locums One. Is this Dr. Chen?
Candidate: Yes, but I am in the middle of something. Can you call back?
AI: Of course! When would be a good time to reach you?
Candidate: Maybe tomorrow afternoon around 3pm?
AI: I will make a note to call back tomorrow afternoon. Thank you Dr. Chen!',
  NOW() - INTERVAL '2 days', '+12185628671', 'ai'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_logs WHERE phone_number = '+15559876543' AND call_result = 'callback_requested'
);

INSERT INTO public.ai_call_logs (
  candidate_name, phone_number, status, call_result, duration_seconds,
  created_at, from_number, call_type, voicemail_left
)
SELECT 
  'Unknown', '+15557890123', 'completed', 'voicemail', 45,
  NOW() - INTERVAL '4 hours', '+12185628671', 'ai', true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_logs WHERE phone_number = '+15557890123'
);