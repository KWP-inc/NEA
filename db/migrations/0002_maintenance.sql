-- Daily housekeeping. Called once a day by `npm run db:maintain` (or POST /api/cron/maintenance with CRON_SECRET).
-- 1. Make sure this month's and next month's activity partitions exist.
-- 2. Roll yesterday's activity into activity_daily.
-- 3. Drop activity partitions older than 25 months (the daily summary stays).
-- 4. Delete expired sign-in codes, sessions, rate-limit rows and parent requests.
-- 5. Delete under-18 accounts whose parent did not say yes within 7 days.
CREATE OR REPLACE FUNCTION nea_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dropped int := 0;
  part record;
  cutoff date := (date_trunc('month', now()) - interval '25 months')::date;
  removed_children int;
BEGIN
  PERFORM ensure_activity_partition(date_trunc('month', now())::date);
  PERFORM ensure_activity_partition((date_trunc('month', now()) + interval '1 month')::date);

  INSERT INTO activity_daily (day, name, events, visitors)
  SELECT created_at::date, name, count(*), count(DISTINCT anon_id)
  FROM activity_events
  WHERE created_at >= (now() - interval '2 days')::date AND created_at < now()::date
  GROUP BY 1, 2
  ON CONFLICT (day, name) DO UPDATE SET events = EXCLUDED.events, visitors = EXCLUDED.visitors;

  FOR part IN
    SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'activity_events' AND c.relname ~ '^activity_events_[0-9]{4}_[0-9]{2}$'
  LOOP
    IF to_date(substr(part.relname, 17), 'YYYY_MM') < cutoff THEN
      EXECUTE format('DROP TABLE %I', part.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  DELETE FROM login_codes WHERE expires_at < now() - interval '1 day';
  DELETE FROM sessions WHERE expires_at < now();
  DELETE FROM rate_limits WHERE reset_at < now();
  DELETE FROM parent_consents WHERE consented_at IS NULL AND expires_at < now();
  DELETE FROM users WHERE status = 'pending_parent' AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS removed_children = ROW_COUNT;

  RETURN jsonb_build_object('dropped_partitions', dropped, 'removed_unconsented_children', removed_children, 'ran_at', now());
END $$;
REVOKE ALL ON FUNCTION nea_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nea_maintenance() TO nea_app;
