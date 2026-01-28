-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the SMS queue processor to run every minute
SELECT cron.schedule(
  'process-sms-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/process-sms-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnl6eXNwd3h3dHdqaGZjdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTEyODYsImV4cCI6MjA4MTgyNzI4Nn0.yTePf_4bp6ZkZH_kI2YXlRN69SKGjVEKcdzX2bGW4OA"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);