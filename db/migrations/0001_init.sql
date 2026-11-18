-- NEA Precision Skin: first database migration.
-- Run by `npm run db:migrate` as the database OWNER (DATABASE_OWNER_URL).
-- The website itself connects as `nea_app`, which does not own any table and cannot bypass Row Level Security.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────── Roles ─────────
-- nea_app: the role the website uses. Password is set by DevOps (see DEPLOY.md), never here.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nea_app') THEN
    CREATE ROLE nea_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- Helpers that read the per-request context set by the app with SET LOCAL.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;
-- system = sign-in flows and background jobs run by server code; staff/admin = signed-in staff with MFA.
CREATE OR REPLACE FUNCTION app_is_trusted() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app_role() IN ('system', 'staff', 'admin') $$;

-- ───────── Users and sign-in ─────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL DEFAULT '',
  birth_ym      char(7),                      -- 'YYYY-MM'
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'staff', 'admin')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_parent', 'disabled')),
  marketing     boolean NOT NULL DEFAULT false,
  club_code     text NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  imported_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE UNIQUE INDEX users_club_code_uq ON users (club_code);
CREATE INDEX users_created_idx ON users (created_at DESC);
CREATE INDEX users_role_idx ON users (role) WHERE role <> 'member';

CREATE TABLE auth_identities (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     text NOT NULL CHECK (provider IN ('email', 'google', 'apple')),
  provider_sub text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_sub)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

CREATE TABLE login_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code_hash  text NOT NULL,
  attempts   int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON login_codes (lower(email), created_at DESC);
CREATE INDEX login_codes_expires_idx ON login_codes (expires_at);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  mfa_ok      boolean NOT NULL DEFAULT false,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE UNIQUE INDEX sessions_token_uq ON sessions (token_hash);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE parent_consents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_email  text NOT NULL,
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  consented_at  timestamptz,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX parent_consents_token_uq ON parent_consents (token_hash);
CREATE INDEX parent_consents_child_idx ON parent_consents (child_user_id);

-- Proof of consent. Insert-only: withdrawing adds a new row with given = false.
CREATE TABLE consents (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('privacy', 'marketing', 'parent')),
  version    text NOT NULL,
  given      boolean NOT NULL,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_user_idx ON consents (user_id, created_at DESC);

-- Staff two-step sign-in (TOTP). The secret is encrypted by the app (AES-256-GCM, DATA_ENC_KEY).
CREATE TABLE staff_mfa (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc    text NOT NULL,
  confirmed_at  timestamptz,
  backup_hashes text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ───────── Member data (numbers only, never photos) ─────────
CREATE TABLE scans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_ref text,                    -- the device's own id, so photos kept on the phone can be matched
  source     text NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'lens', 'import')),
  score      smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  bpm        smallint CHECK (bpm BETWEEN 30 AND 220),
  metrics    jsonb NOT NULL DEFAULT '[]',
  taken_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scans_user_idx ON scans (user_id, taken_at DESC);
CREATE UNIQUE INDEX scans_client_ref_uq ON scans (user_id, client_ref) WHERE client_ref IS NOT NULL;

-- Routine, event countdown and injectables plan: one JSON document each per member (size-checked by the app).
CREATE TABLE glow_docs (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('routine', 'event', 'plan')),
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

-- Glow Club points: a ledger. Rows are never edited; the balance is the sum.
CREATE TABLE points_ledger (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,          -- scan, routine, event, planner, share, code, import, staff, redeem
  delta       int NOT NULL CHECK (delta BETWEEN -5000 AND 5000),
  label       text NOT NULL DEFAULT '',
  code        text,
  by_staff_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX points_user_idx ON points_ledger (user_id, created_at DESC);
CREATE INDEX points_kind_idx ON points_ledger (user_id, kind, created_at DESC);

CREATE TABLE redemptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward     text NOT NULL,
  name       text NOT NULL,
  pts        int NOT NULL CHECK (pts > 0),
  code       text NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX redemptions_user_idx ON redemptions (user_id, created_at DESC);
CREATE UNIQUE INDEX redemptions_code_uq ON redemptions (code);

-- ───────── Leads (website forms) ─────────
CREATE TABLE leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL,
  name       text NOT NULL,
  email      text,
  phone      text,
  message    text,
  meta       jsonb NOT NULL DEFAULT '{}',
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_created_idx ON leads (created_at DESC);

-- ───────── Activity (first-party analytics), split by month ─────────
CREATE TABLE activity_events (
  id         bigserial,
  user_id    uuid,
  anon_id    text NOT NULL,
  session_id text NOT NULL,
  name       text NOT NULL,
  path       text NOT NULL DEFAULT '',
  props      jsonb NOT NULL DEFAULT '{}',
  utm        jsonb NOT NULL DEFAULT '{}',
  referrer   text,
  device     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX activity_created_idx ON activity_events (created_at);
CREATE INDEX activity_name_idx ON activity_events (name, created_at);
CREATE INDEX activity_user_idx ON activity_events (user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX activity_session_idx ON activity_events (session_id, created_at);
CREATE TABLE activity_events_default PARTITION OF activity_events DEFAULT;

-- Creates the partition for a month (the app calls this for this month and next month every day).
CREATE OR REPLACE FUNCTION ensure_activity_partition(month_start date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  part text := 'activity_events_' || to_char(month_start, 'YYYY_MM');
BEGIN
  IF to_regclass(part) IS NULL THEN
    EXECUTE format('CREATE TABLE %I PARTITION OF activity_events FOR VALUES FROM (%L) TO (%L)', part, month_start, (month_start + interval '1 month')::date);
  END IF;
END $$;
SELECT ensure_activity_partition(date_trunc('month', now())::date);
SELECT ensure_activity_partition((date_trunc('month', now()) + interval '1 month')::date);

-- Daily summary kept after raw events are dropped (25 months).
CREATE TABLE activity_daily (
  day      date NOT NULL,
  name     text NOT NULL,
  events   int NOT NULL,
  visitors int NOT NULL,
  PRIMARY KEY (day, name)
);

-- ───────── Audit log (staff actions). Insert-only. ─────────
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  staff_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  target     text,
  detail     jsonb NOT NULL DEFAULT '{}',
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log (created_at DESC);

-- ───────── Rate limits and one-time captcha use ─────────
CREATE UNLOGGED TABLE rate_limits (
  key      text PRIMARY KEY,
  count    int NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_reset_idx ON rate_limits (reset_at);

-- ───────── Row Level Security ─────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE glow_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- A member sees and changes only their own rows. Trusted server contexts (system / staff / admin) see all.
CREATE POLICY users_self ON users USING (id = app_user_id() OR app_is_trusted()) WITH CHECK (id = app_user_id() OR app_is_trusted());
CREATE POLICY ident_self ON auth_identities USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY consents_self ON consents USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY scans_self ON scans USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY docs_self ON glow_docs USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY points_self ON points_ledger USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY redeem_self ON redemptions USING (user_id = app_user_id() OR app_is_trusted()) WITH CHECK (user_id = app_user_id() OR app_is_trusted());
-- Sign-in machinery and staff data: server (system) and staff only.
CREATE POLICY codes_sys ON login_codes USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY sessions_sys ON sessions USING (app_role() IN ('system', 'admin') OR user_id = app_user_id()) WITH CHECK (app_role() = 'system' OR user_id = app_user_id());
CREATE POLICY parent_sys ON parent_consents USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY mfa_sys ON staff_mfa USING (app_role() = 'system' OR (user_id = app_user_id() AND app_role() IN ('staff', 'admin'))) WITH CHECK (app_role() = 'system' OR (user_id = app_user_id() AND app_role() IN ('staff', 'admin')));
CREATE POLICY rl_sys ON rate_limits USING (true) WITH CHECK (true);
-- Leads and activity: anyone may add (forms and analytics), only staff may read.
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY leads_read ON leads FOR SELECT USING (app_role() IN ('staff', 'admin'));
CREATE POLICY leads_delete ON leads FOR DELETE USING (app_role() = 'admin');
CREATE POLICY activity_insert ON activity_events FOR INSERT WITH CHECK (true);
CREATE POLICY activity_read ON activity_events FOR SELECT USING (app_role() IN ('staff', 'admin', 'system'));
CREATE POLICY activity_forget ON activity_events FOR UPDATE USING (app_role() = 'system' OR user_id = app_user_id()) WITH CHECK (true);
CREATE POLICY daily_all ON activity_daily USING (app_role() IN ('staff', 'admin', 'system')) WITH CHECK (app_role() = 'system');
-- Audit log: staff can add, only admin can read, nobody can change or delete (no grant below).
CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (app_role() IN ('staff', 'admin', 'system'));
CREATE POLICY audit_read ON audit_log FOR SELECT USING (app_role() = 'admin');

-- ───────── Grants for the website role ─────────
GRANT USAGE ON SCHEMA public TO nea_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, auth_identities, login_codes, sessions, parent_consents, staff_mfa, scans, glow_docs, redemptions, rate_limits TO nea_app;
GRANT SELECT, INSERT ON consents, points_ledger TO nea_app;           -- ledgers: no update, no delete
GRANT SELECT, INSERT, DELETE ON leads TO nea_app;
GRANT SELECT, INSERT, UPDATE ON activity_events TO nea_app;           -- update only to anonymise on account delete
GRANT SELECT, INSERT, UPDATE ON activity_daily TO nea_app;
GRANT SELECT, INSERT ON audit_log TO nea_app;                         -- insert-only
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO nea_app;
GRANT EXECUTE ON FUNCTION app_user_id(), app_role(), app_is_trusted(), ensure_activity_partition(date) TO nea_app;
-- Deleting a member cascades into ledgers; give the cascade path its rights through the owner (ON DELETE CASCADE runs as owner).
