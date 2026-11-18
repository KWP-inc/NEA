#!/usr/bin/env python3
"""
NEA API + security test suite. Runs against a running server and a mail catcher.

  BASE=http://localhost:3000 MAIL_DIR=/tmp/mail ADMIN_PATH=staff-xxxx DATABASE_OWNER_URL=postgres://… python3 tests/security.py

Covers: sign-up/sign-in by email code, age rules (16+, parent consent under 18), My Glow saving, server-side
points and rewards, export/delete, plus attacks: CSRF, IDOR, SQL injection, XSS storage, rate limits,
captcha replay, hidden admin, staff MFA, upload type checks, cookie flags, error leaks.
Writes a report to tests/out/security-report.md. Exit code 1 if anything fails.
"""
import base64, email, glob, hashlib, hmac, json, os, re, struct, subprocess, sys, time, urllib.request, urllib.error
from datetime import date

BASE = os.environ.get("BASE", "http://localhost:3000").rstrip("/")
MAIL = os.environ.get("MAIL_DIR", "/tmp/mail")
ADMIN = os.environ.get("ADMIN_PATH", "")
OWNER_URL = os.environ.get("DATABASE_OWNER_URL", "")
ORIGIN = BASE
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))


class Client:
    """Tiny HTTP client that keeps cookies by hand (so Secure cookies also work against http://localhost)."""

    def __init__(self, ip):
        self.cookies = {}
        self.ip = ip
        self.last_set_cookie = []

    def req(self, method, path, body=None, origin=ORIGIN, headers=None, raw=False):
        data = None
        h = {"X-Forwarded-For": self.ip, "User-Agent": "nea-test"}
        if body is not None:
            data = json.dumps(body).encode() if not isinstance(body, (bytes, str)) else (body.encode() if isinstance(body, str) else body)
            h["Content-Type"] = "application/json"
        if origin:
            h["Origin"] = origin
        if self.cookies:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        if headers:
            h.update(headers)
        r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            resp = urllib.request.urlopen(r, timeout=30)
            status, hdrs, text = resp.status, resp.headers, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            status, hdrs, text = e.code, e.headers, e.read().decode("utf-8", "replace")
        self.last_set_cookie = hdrs.get_all("Set-Cookie") or []
        for sc in self.last_set_cookie:
            k, v = sc.split(";", 1)[0].split("=", 1)
            if "Max-Age=0" in sc or v == "":
                self.cookies.pop(k, None)
            else:
                self.cookies[k] = v
        if raw:
            return status, hdrs, text
        try:
            return status, json.loads(text) if text else {}
        except json.JSONDecodeError:
            return status, {"_text": text[:300]}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def solve_captcha(c):
    st, ch = c.req("GET", "/api/auth/captcha", origin=None)
    assert st == 200, ch
    mx = ch.get("maxnumber") or ch.get("maxNumber") or 100000
    for n in range(mx + 1):
        if hashlib.sha256((ch["salt"] + str(n)).encode()).hexdigest() == ch["challenge"]:
            return base64.b64encode(json.dumps({"algorithm": ch["algorithm"], "challenge": ch["challenge"], "number": n, "salt": ch["salt"], "signature": ch["signature"]}).encode()).decode()
    raise RuntimeError("captcha unsolved")


def mail_for(addr, after):
    for _ in range(40):
        for f in sorted(glob.glob(f"{MAIL}/*.eml"), reverse=True):
            if os.path.getmtime(f) < after:
                continue
            m = email.message_from_bytes(open(f, "rb").read())
            if addr.lower() in (m.get("To") or "").lower():
                body = ""
                for part in m.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode()
                return m.get("Subject", ""), body
        time.sleep(0.25)
    return None, None


def sign_up(c, addr, birth_ym, name="Test", parent=None, marketing=True):
    t0 = time.time()
    st, d = c.req("POST", "/api/auth/code", {"email": addr, "captcha": solve_captcha(c)})
    assert st == 200, (st, d)
    subj, body = mail_for(addr, t0 - 1)
    code = re.search(r"\b(\d{6})\b", subj or "").group(1)
    st, d = c.req("POST", "/api/auth/verify", {"email": addr, "code": code})
    assert st == 200, (st, d)
    if d.get("status") == "signed-in":
        return d
    body = {"name": name, "birthYm": birth_ym, "privacy": True, "marketing": marketing}
    if parent:
        body["parentEmail"] = parent
    return c.req("POST", "/api/auth/complete", body)


def ym(years_ago, month_offset=0):
    t = date.today()
    y = t.year - years_ago
    m = t.month + month_offset
    while m < 1:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return f"{y}-{m:02d}"


def totp(secret_b32):
    key = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8))
    ctr = struct.pack(">Q", int(time.time()) // 30)
    h = hmac.new(key, ctr, hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return f"{(struct.unpack('>I', h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def boss_id(c):
    st, me = c.req("GET", "/api/auth/me", origin=None)
    st, d = c.req("GET", f"/api/staff/members?q={urllib.parse.quote(me['user']['email'])}", origin=None)
    return d["rows"][0]["id"]


def main():
    run = str(int(time.time()))
    a = Client("10.1.0.1")
    b = Client("10.1.0.2")
    ea, eb = f"alice{run}@nea.test", f"bob{run}@nea.test"

    # ── Sign-up rules ──
    st, d = a.req("POST", "/api/auth/code", {"email": ea, "captcha": "x"})
    check("captcha required for sign-in code", st == 400)
    st, d = a.req("POST", "/api/auth/code", {"email": "not-an-email", "captcha": solve_captcha(a)})
    check("bad email rejected", st == 400)

    young = Client("10.1.0.3")
    st, d = sign_up(young, f"kid{run}@nea.test", ym(15))
    check("under 16 cannot sign up", st == 400 and "16" in d.get("error", ""), str(d))

    st, d = sign_up(a, ea, ym(30), name="Alice <script>alert(1)</script>")
    check("adult sign-up works", st == 200 and d.get("status") == "active", str(d))
    sess = [s for s in a.last_set_cookie if "session" in s]
    flags = sess[0] if sess else ""
    check("session cookie HttpOnly", "HttpOnly" in flags, flags)
    check("session cookie SameSite=Lax", "SameSite=lax" in flags.lower().replace("samesite=lax", "SameSite=lax") or "samesite=lax" in flags.lower(), flags)
    prod = "__Host-" in flags
    check("session cookie Secure + __Host- prefix (production)", (not prod) or ("Secure" in flags), flags)

    st, me = a.req("GET", "/api/auth/me", origin=None)
    check("/api/auth/me shows the member", st == 200 and me["user"]["email"] == ea, str(me))
    check("XSS text stored as plain text (React escapes on output)", "<script>" in me["user"]["name"])

    st, d = sign_up(b, eb, ym(40))
    check("second member sign-up", st == 200)

    # ── My Glow saving and server-side points ──
    scan = {"id": "scanA1", "score": 72, "bpm": 68, "metrics": [{"key": "heart", "label": "Heart rate", "value": "68 bpm", "level": 80}]}
    st, d = a.req("POST", "/api/me/scans", scan)
    check("save scan (numbers only)", st == 200 and d.get("pts") == 10, str(d))
    st, d = a.req("POST", "/api/me/scans", {**scan, "id": "scanA2"})
    check("scan points once per day", st == 200 and d.get("pts") == 0, str(d))
    st, d = a.req("POST", "/api/me/scans", {**scan, "id": "scanA3", "photo": "data:image/jpeg;base64,AAAA"})
    st2, g = a.req("GET", "/api/me/glow", origin=None)
    check("photo field is ignored (never stored)", "photo" not in json.dumps(g["diary"]), "")
    st, d = a.req("PUT", "/api/me/glow", {"kind": "routine", "value": [{"name": "Cleanser", "step": "am"}]})
    check("save routine", st == 200)
    st, d = a.req("PUT", "/api/me/glow", {"kind": "routine", "value": [{"x": "y" * 40000}]})
    check("oversized document refused", st == 400)
    st, d = a.req("POST", "/api/me/points", {"kind": "routine"})
    check("routine points given by server", d.get("pts") == 20, str(d))
    st, d = a.req("POST", "/api/me/points", {"kind": "routine"})
    check("routine points only once", d.get("pts") == 0, str(d))
    st, d = a.req("POST", "/api/me/points", {"kind": "code", "code": "GLOW50"})
    check("valid clinic code gives points", d.get("pts") == 50, str(d))
    st, d = a.req("POST", "/api/me/points", {"kind": "code", "code": "GLOW50"})
    check("same clinic code refused the same day", st == 404, str(d))
    st, d = a.req("POST", "/api/me/points", {"kind": "code", "code": "FAKE999"})
    check("invalid clinic code refused", st == 404)
    st, d = a.req("POST", "/api/me/points", {"kind": "scan"})
    check("client cannot award itself scan points directly", st == 400)
    st, d = a.req("POST", "/api/me/redeem", {"reward": "samples"})
    check("reward refused without enough points (80 < 100)", st == 400, str(d))
    st, d = a.req("POST", "/api/me/import", {"diary": [], "points": 50000})
    st2, g = a.req("GET", "/api/me/glow", origin=None)
    bal = sum(e["pts"] for e in g["club"]["ledger"]) - sum(r["pts"] for r in g["club"]["redeemed"])
    check("imported phone points capped at 100", bal <= 80 + 100, f"balance={bal}")
    st, d = a.req("POST", "/api/me/import", {"diary": [], "points": 100})
    st2, g2 = a.req("GET", "/api/me/glow", origin=None)
    bal2 = sum(e["pts"] for e in g2["club"]["ledger"])
    check("import runs only once", bal2 == sum(e["pts"] for e in g["club"]["ledger"]), f"{bal2}")
    st, d = a.req("POST", "/api/me/redeem", {"reward": "samples"})
    check("reward redeemed when balance allows", st == 200 and d["redeemed"]["code"], str(d))
    reward_code = d.get("redeemed", {}).get("code", "")

    # ── IDOR: Bob tries Alice's things ──
    st, d = b.req("DELETE", "/api/me/scans", {"id": "scanA1"})
    st2, g = a.req("GET", "/api/me/glow", origin=None)
    check("IDOR: member B cannot delete member A's scan", any(e["id"] == "scanA1" for e in g["diary"]))
    st, gb = b.req("GET", "/api/me/glow", origin=None)
    check("IDOR: member B sees none of A's scans", not any(e["id"].startswith("scanA") for e in gb["diary"]))
    st, d = b.req("GET", "/api/staff/members", origin=None)
    check("member cannot reach staff API (404)", st == 404)
    st, d = b.req("POST", "/api/staff/points", {"userId": "00000000-0000-0000-0000-000000000000", "delta": 500, "reason": "hack"})
    check("member cannot give points via staff API (404)", st == 404)

    # ── CSRF ──
    st, d = a.req("POST", "/api/me/points", {"kind": "event"}, origin="https://evil.example")
    check("CSRF: other-site Origin refused (403)", st == 403)
    st, d = a.req("POST", "/api/me/points", {"kind": "event"}, origin=None)
    check("CSRF: missing Origin refused (403)", st == 403)
    st, d = a.req("POST", "/api/lead", {"kind": "contact", "name": "x", "email": "x@y.z", "message": "hi", "captcha": "x"}, origin="https://evil.example")
    check("CSRF: lead form from other site refused", st == 403)

    # ── Injection ──
    st, d = a.req("POST", "/api/auth/verify", {"email": "a@b.com' OR '1'='1", "code": "123456"})
    check("SQLi: quote in email rejected by schema", st == 400)
    st, d = a.req("DELETE", "/api/me/scans", {"id": "x' OR '1'='1"})
    check("SQLi: quote in id rejected by schema", st == 400)
    st, d = a.req("POST", "/api/me/scans", {"id": "ok1", "score": "70; DROP TABLE users", "metrics": []})
    check("type confusion rejected", st == 400)
    st, d = a.req("POST", "/api/lead", "{not json", headers={"Content-Type": "application/json"})
    check("broken JSON gets a short 400, no stack trace", st == 400 and "at " not in json.dumps(d))

    # ── Leads ──
    st, d = a.req("POST", "/api/lead", {"kind": "contact", "name": "<img src=x onerror=alert(1)>", "email": "lead@nea.test", "message": "=HYPERLINK(\"http://evil\")", "captcha": solve_captcha(a)})
    check("lead saved with captcha", st == 200, str(d))
    st, d = a.req("POST", "/api/lead", {"kind": "contact", "name": "bot", "email": "bot@nea.test", "captcha": "x", "company_website": "spam"})
    check("honeypot: bot gets a fake OK", st == 200)
    cap = solve_captcha(a)
    st1, _ = a.req("POST", "/api/lead", {"kind": "contact", "name": "r1", "email": "r@nea.test", "message": "1", "captcha": cap})
    st2, _ = a.req("POST", "/api/lead", {"kind": "contact", "name": "r2", "email": "r@nea.test", "message": "2", "captcha": cap})
    check("captcha cannot be replayed", st1 == 200 and st2 == 400, f"{st1},{st2}")

    # ── Uploads ──
    fake = "data:image/jpeg;base64," + base64.b64encode(b"<?php echo 1; ?>" + b"0" * 64).decode()
    st, d = a.req("POST", "/api/lens", {"image": fake})
    check("upload: fake JPEG (wrong magic bytes) refused", st == 400, str(d))
    st, d = a.req("POST", "/api/lens", {"image": "data:image/svg+xml;base64,PHN2Zz4="})
    check("upload: SVG refused", st == 400)

    # ── Minor + parent consent ──
    teen = Client("10.1.0.4")
    pe = f"parent{run}@nea.test"
    st, d = sign_up(teen, f"teen{run}@nea.test", ym(17), name="Sam", parent=pe)
    check("16–17 sign-up waits for a parent", st == 200 and d.get("status") == "pending_parent", str(d))
    st, d = teen.req("GET", "/api/me/glow", origin=None)
    check("pending child cannot save data", st == 401)
    subj, body = mail_for(pe, time.time() - 30)
    m = re.search(r"/account/parent\?t=([A-Za-z0-9_\-%]+)", body or "")
    check("parent receives consent email", bool(m))
    if m:
        t = urllib.parse.unquote(m.group(1))
        parent = Client("10.1.0.5")
        st, d = parent.req("POST", "/api/auth/parent", {"t": t, "yes": True, "captcha": solve_captcha(parent)})
        check("parent says yes", st == 200, str(d))
        st, d = teen.req("GET", "/api/me/glow", origin=None)
        check("child account turns on after consent", st == 200)
        st, d = parent.req("POST", "/api/auth/parent", {"t": t, "yes": True, "captcha": solve_captcha(parent)})
        check("consent link works only once", st == 400)
        st, d = teen.req("PATCH", "/api/me/profile", {"marketing": True})
        check("no marketing opt-in for under 18", st == 400)

    # ── Rate limits ──
    rl = Client("10.1.0.9")
    codes = []
    for i in range(14):
        st, _ = rl.req("POST", "/api/auth/verify", {"email": f"x{i}@nea.test", "code": "000000"})
        codes.append(st)
    hammer = Client("10.1.0.10")
    sts = [hammer.req("POST", "/api/me/points", {"kind": "event"})[0] for _ in range(25)]
    check("rate limit: sign-in code checks are limited", 429 in [rl.req("POST", "/api/auth/verify", {"email": "y@nea.test", "code": "000000"})[0] for _ in range(25)])
    check("rate limit: API answers 429 when flooded", 429 in [hammer.req("GET", "/api/auth/captcha", origin=None)[0] for _ in range(70)])

    # ── Hidden admin + MFA ──
    st, _, _ = Client("10.2.0.1").req("GET", "/staff-portal", origin=None, raw=True)
    check("internal admin path is a 404", st == 404)
    st, _, html = Client("10.2.0.2").req("GET", f"/{ADMIN}", origin=None, raw=True)
    check("secret admin path is a 404 for visitors", st == 404)
    st, _, html = a.req("GET", f"/{ADMIN}", origin=None, raw=True)
    check("secret admin path is a 404 for members", st == 404)
    st, h, _ = Client("10.2.0.3").req("GET", "/api/staff/stats", origin=None, raw=True)
    check("staff API is a 404 when signed out", st == 404)

    boss_mail = f"boss{run}@nea.test"
    subprocess.run(["node", "scripts/create-admin.mjs", boss_mail, "Boss"], check=True, env={**os.environ, "DATABASE_OWNER_URL": OWNER_URL}, capture_output=True)
    boss = Client("10.2.0.4")
    sign_up(boss, boss_mail, ym(35))
    st, d = boss.req("GET", "/api/staff/stats", origin=None)
    check("admin without two-step is blocked from data (404)", st == 404)
    st, mfa = boss.req("GET", "/api/staff/mfa", origin=None)
    check("two-step setup gives a QR code", st == 200 and mfa.get("qr", "").startswith("data:image/png"), str(mfa)[:120])
    st, d = boss.req("POST", "/api/staff/mfa", {"code": "000000"})
    check("wrong two-step code refused", st == 400)
    old = dict(boss.cookies)
    used_totp = [totp(mfa["secret"])]
    st, d = boss.req("POST", "/api/staff/mfa", {"code": used_totp[0]})
    check("right two-step code accepted + backup codes", st == 200 and len(d.get("backupCodes", [])) == 10, str(d)[:120])
    check("session token rotated after two-step", old != boss.cookies)
    st, stats = boss.req("GET", "/api/staff/stats?days=30", origin=None)
    check("staff stats work after two-step", st == 200 and "totals" in stats)
    st, _, html = boss.req("GET", f"/{ADMIN}", origin=None, raw=True)
    check("admin page opens for admin", st == 200 and "NEA staff" in html)
    st, h, _ = boss.req("GET", f"/{ADMIN}", origin=None, raw=True)
    check("admin page is noindex + no-store", "noindex" in (h.get("X-Robots-Tag") or "") and "no-store" in (h.get("Cache-Control") or ""))
    st, d = boss.req("GET", "/api/staff/members?q=%27%20OR%201%3D1%20--", origin=None)
    check("SQLi in staff search returns nothing, no error", st == 200 and d["rows"] == [])
    st, d = boss.req("GET", f"/api/staff/members?q={urllib.parse.quote(ea)}", origin=None)
    alice_id = d["rows"][0]["id"] if d.get("rows") else None
    check("staff search finds the member", bool(alice_id))
    st, d = boss.req("POST", "/api/staff/points", {"userId": alice_id, "delta": 100, "reason": "Clinic visit"})
    check("staff gives points", st == 200)
    st, d = boss.req("GET", f"/api/staff/redemptions?code={reward_code}", origin=None)
    rid = d["rows"][0]["id"] if d.get("rows") else None
    st, d = boss.req("POST", "/api/staff/redemptions", {"id": rid})
    check("front desk marks reward used", st == 200)
    st, d = boss.req("POST", "/api/staff/redemptions", {"id": rid})
    check("reward can't be used twice", st == 400)
    st, h, csvtext = boss.req("GET", "/api/staff/leads/export", origin=None, raw=True)
    check("CSV export neutralises formulas (CSV injection)", "\"'=HYPERLINK" in csvtext, csvtext[:200])
    st, d = boss.req("GET", "/api/staff/audit", origin=None)
    acts = {r["action"] for r in d.get("rows", [])}
    check("audit log records staff actions", {"points.adjust", "reward.used", "leads.export", "staff.signin"} <= acts, str(acts))
    st, d = boss.req("GET", "/api/staff/members/not-a-uuid", origin=None)
    check("bad id → 400, no stack trace", st == 400 and "stack" not in json.dumps(d))

    # ── Database refuses privilege changes even if app code had a bug ──
    import shlex
    app_url = os.environ.get("DATABASE_URL", "")
    def psql(sql):
        r = subprocess.run(["psql", app_url, "-v", "ON_ERROR_STOP=1", "-tAc", sql], capture_output=True, text=True)
        return r.returncode, (r.stdout + r.stderr).strip()
    rc, out = psql(f"BEGIN; SELECT set_config('app.role','member',true), set_config('app.user_id','{alice_id}',true); UPDATE users SET role='admin' WHERE id='{alice_id}'; COMMIT;")
    check("DB: a member can't make themselves admin (trigger)", rc != 0 and "not allowed" in out, out[-160:])
    rc, out = psql(f"BEGIN; SELECT set_config('app.role','member',true), set_config('app.user_id','{alice_id}',true); INSERT INTO points_ledger (user_id, kind, delta) VALUES ('{alice_id}','staff',999); COMMIT;")
    check("DB: a member can't add points to the ledger", rc != 0, out[-160:])
    rc, out = psql(f"BEGIN; SELECT set_config('app.role','member',true), set_config('app.user_id','{alice_id}',true); INSERT INTO sessions (user_id, token_hash, mfa_ok, expires_at) VALUES ('{alice_id}','x',true, now()+interval '1 day'); COMMIT;")
    check("DB: a member can't create a session (or fake two-step)", rc != 0, out[-160:])
    rc, out = psql("BEGIN; SELECT set_config('app.role','staff',true); UPDATE users SET role='admin'; COMMIT;")
    check("DB: staff (non-admin) can't change roles (refused or 0 rows)", rc != 0 or "UPDATE 0" in out, out[-160:])

    st, d = boss.req("POST", "/api/staff/points", {"userId": stats and boss_id(boss), "delta": 500, "reason": "self"})
    check("staff can't give themselves points", st == 400, str(d))

    # two-step: a used code can't be replayed; 5 wrong codes lock the account
    boss2 = Client("10.2.0.5")
    sign_up(boss2, boss_mail, ym(35))
    st, d = boss2.req("POST", "/api/staff/mfa", {"code": used_totp[0]})
    check("two-step code can't be replayed", st == 400, str(d))
    for _ in range(5):
        boss2.req("POST", "/api/staff/mfa", {"code": "111111"})
    st, d = boss2.req("POST", "/api/staff/mfa", {"code": totp(mfa["secret"])})
    check("5 wrong two-step codes lock the account for 15 minutes", st == 400 and "Too many" in d.get("error", ""), str(d))

    # sign-in code guessing is capped per email across IPs
    victim = f"victim{run}@nea.test"
    vc = Client("10.4.0.1")
    vc.req("POST", "/api/auth/code", {"email": victim, "captcha": solve_captcha(vc)})
    code = None
    subj, _ = mail_for(victim, time.time() - 30)
    code = re.search(r"\b(\d{6})\b", subj or "").group(1)
    for i in range(21):
        Client(f"10.4.1.{i}").req("POST", "/api/auth/verify", {"email": victim, "code": "000000" if code != "000000" else "111111"})
    st, d = Client("10.4.2.1").req("POST", "/api/auth/verify", {"email": victim, "code": code})
    check("20 wrong codes for one email (from many IPs) block further tries for a day", st == 429, str(d))

    # activity rows of a deleted member are anonymised
    a.req("POST", "/api/events", {"anon": "anonAAAAAAAA", "sid": "sessAAAAAAAA", "events": [{"name": "page_view", "path": "/", "t": int(time.time() * 1000)}]})

    # ── Account data rights ──
    st, h, text = a.req("GET", "/api/me/export", origin=None, raw=True)
    check("download my data works", st == 200 and ea in text and "attachment" in (h.get("Content-Disposition") or ""))
    check("export has no photos", "data:image" not in text)
    st, d = a.req("POST", "/api/me/delete", {"confirm": "nope"})
    check("delete needs the word DELETE", st == 400)
    st, d = a.req("POST", "/api/me/delete", {"confirm": "DELETE"})
    check("delete my account", st == 200)
    st, me = a.req("GET", "/api/auth/me", origin=None)
    check("signed out after delete", me.get("user") is None)
    st, d = boss.req("GET", f"/api/staff/members?q={urllib.parse.quote(ea)}", origin=None)
    check("deleted member is really gone", d.get("rows") == [])
    r = subprocess.run(["psql", OWNER_URL, "-tAc", f"SELECT count(*) FROM activity_events WHERE user_id = '{alice_id}'"], capture_output=True, text=True)
    check("deleted member's activity is anonymised", r.stdout.strip() == "0", r.stdout + r.stderr)

    # ── Misc ──
    st, h, _ = Client("10.3.0.1").req("POST", "/api/cron/maintenance", origin=None, raw=True)
    check("maintenance route hidden without secret", st == 404)
    st, h, _ = Client("10.3.0.2").req("GET", "/api/instagram/refresh", origin=None, raw=True)
    check("instagram refresh hidden without secret", st == 404)
    st, h, _ = Client("10.3.0.3").req("OPTIONS", "/api/me/glow", origin="https://evil.example", raw=True)
    check("CORS: no Access-Control-Allow-Origin for other sites", not h.get("Access-Control-Allow-Origin"))

    # ── Report ──
    os.makedirs("tests/out", exist_ok=True)
    passed = sum(1 for r in results if r[1])
    with open("tests/out/security-report.md", "w") as f:
        f.write(f"# API and security tests\n\n{passed} of {len(results)} passed · {time.strftime('%Y-%m-%d %H:%M')}\n\n| Result | Check |\n| --- | --- |\n")
        for n, ok, det in results:
            f.write(f"| {'✅' if ok else '❌'} | {n}{(' — ' + det) if det and not ok else ''} |\n")
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)


import urllib.parse  # noqa: E402

if __name__ == "__main__":
    main()
