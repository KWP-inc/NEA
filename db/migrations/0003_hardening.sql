-- Hardening after the independent security review (update 26).
-- The app already enforces all of this; these rules make the database refuse it too.

-- 1. Only an admin (or our own server code) may change someone's role, status, Glow Club code or import mark.
CREATE OR REPLACE FUNCTION users_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF app_role() NOT IN ('admin', 'system') AND (
       NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status OR
       NEW.club_code IS DISTINCT FROM OLD.club_code OR NEW.imported_at IS DISTINCT FROM OLD.imported_at OR
       NEW.email IS DISTINCT FROM OLD.email OR NEW.birth_ym IS DISTINCT FROM OLD.birth_ym) THEN
    RAISE EXCEPTION 'not allowed to change protected account fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_guard BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION users_guard();

-- New accounts may only be created by server code (sign-up) or an admin (adding staff).
DROP POLICY users_self ON users;
CREATE POLICY users_read ON users FOR SELECT USING (id = app_user_id() OR app_is_trusted());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (app_role() IN ('system', 'admin'));
CREATE POLICY users_update ON users FOR UPDATE USING (id = app_user_id() OR app_role() IN ('system', 'admin')) WITH CHECK (id = app_user_id() OR app_role() IN ('system', 'admin'));
CREATE POLICY users_delete ON users FOR DELETE USING (id = app_user_id() OR app_role() IN ('system', 'admin'));

-- 2. Sessions are created only by server code (sign-in). A member can see and end their own.
DROP POLICY sessions_sys ON sessions;
CREATE POLICY sessions_read ON sessions FOR SELECT USING (app_role() IN ('system', 'admin') OR user_id = app_user_id());
CREATE POLICY sessions_insert ON sessions FOR INSERT WITH CHECK (app_role() = 'system');
CREATE POLICY sessions_update ON sessions FOR UPDATE USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY sessions_delete ON sessions FOR DELETE USING (app_role() IN ('system', 'admin') OR user_id = app_user_id());

-- 3. Points: members can read their own ledger, but only server code or staff can add to it.
DROP POLICY points_self ON points_ledger;
CREATE POLICY points_read ON points_ledger FOR SELECT USING (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY points_insert ON points_ledger FOR INSERT WITH CHECK (app_is_trusted());

-- 4. Rewards: members read their own; only server code creates them; only staff mark them used.
DROP POLICY redeem_self ON redemptions;
CREATE POLICY redeem_read ON redemptions FOR SELECT USING (user_id = app_user_id() OR app_is_trusted());
CREATE POLICY redeem_insert ON redemptions FOR INSERT WITH CHECK (app_role() = 'system');
CREATE POLICY redeem_update ON redemptions FOR UPDATE USING (app_role() IN ('staff', 'admin')) WITH CHECK (app_role() IN ('staff', 'admin'));

-- 5. Anonymising activity on account delete: done by server code, and the only allowed change is clearing user_id.
DROP POLICY activity_forget ON activity_events;
CREATE POLICY activity_forget ON activity_events FOR UPDATE USING (app_role() = 'system') WITH CHECK (user_id IS NULL);

-- 6. Rate-limit rows: only server code.
DROP POLICY rl_sys ON rate_limits;
CREATE POLICY rl_sys ON rate_limits USING (app_role() = 'system') WITH CHECK (app_role() = 'system');

-- 7. Staff two-step sign-in: remember the last time-step used (a code can't be replayed) and count failures.
ALTER TABLE staff_mfa ADD COLUMN last_step bigint NOT NULL DEFAULT 0;

-- 8. Clinic codes: each code counts once per member (not once a day).
CREATE UNIQUE INDEX points_code_once ON points_ledger (user_id, code) WHERE kind = 'code';

-- 9. Functions callable by the website only.
REVOKE ALL ON FUNCTION ensure_activity_partition(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_activity_partition(date) TO nea_app;

-- 10. An admin can reset another staff member's two-step sign-in.
CREATE POLICY mfa_admin_reset ON staff_mfa FOR DELETE USING (app_role() = 'admin');
