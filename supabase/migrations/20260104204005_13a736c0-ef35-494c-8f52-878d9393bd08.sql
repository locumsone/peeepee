-- Insert sms_conversation for existing ATLAZ Test candidate
DO $$
DECLARE
  v_candidate_id uuid;
BEGIN
  SELECT id INTO v_candidate_id FROM public.candidates WHERE phone = '+16784675978' LIMIT 1;
  
  IF v_candidate_id IS NOT NULL THEN
    INSERT INTO public.sms_conversations (
      candidate_id,
      candidate_phone,
      telnyx_number,
      status,
      unread_count,
      total_messages,
      last_message_at
    ) VALUES (
      v_candidate_id,
      '+16784675978',
      '+12185628671',
      'active',
      0,
      0,
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;