-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the sync-matches Edge Function to run every 10 minutes
-- This will call the Edge Function via HTTP
SELECT cron.schedule(
  'sync-matches-every-10-minutes',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )::jsonb
  );
  $$
);

-- To verify the job was scheduled:
-- SELECT * FROM cron.job;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('sync-matches-every-10-minutes');
