-- Add Marc's signature for SMS/Email sending
INSERT INTO user_signatures (user_id, full_name, first_name, title, company, phone)
VALUES (
  '71caf47f-8359-4e67-9ce7-619e5066ee56',
  'Marc',
  'Marc',
  'Clinical Consultant',
  'Locums One',
  null
)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  first_name = EXCLUDED.first_name,
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  updated_at = now();