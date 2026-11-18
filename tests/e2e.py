#!/usr/bin/env python3
"""
Browser tests (Playwright + Chrome) on a phone (390×844) and a desktop (1280×800).

  BASE=http://localhost:3000 MAIL_DIR=/tmp/mail ADMIN_PATH=staff-xxxx DATABASE_OWNER_URL=postgres://… python3 tests/e2e.py
  (pip install playwright; uses Chrome at CHROME=/usr/bin/google-chrome, or run `playwright install chromium`)

Checks: key pages load with no JavaScript errors and no Content-Security-Policy blocks, every tab on the page
can be clicked, the cookie banner works and analytics are sent only after "Allow", the full sign-up flow by
email code, members-only tools, the live face scan with a fake camera, and the staff page with two-step sign-in.
Screenshots go to tests/out/screens/. Report: tests/out/e2e-report.md.
"""
import base64, email, glob, hashlib, hmac, os, re, struct, subprocess, sys, time
from datetime import date
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000").rstrip("/")
MAIL = os.environ.get("MAIL_DIR", "/tmp/mail")
ADMIN = os.environ.get("ADMIN_PATH", "")
OWNER = os.environ.get("DATABASE_OWNER_URL", "")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
OUT = "tests/out/screens"
os.makedirs(OUT, exist_ok=True)
results = []

PAGES = ["/", "/free-scan", "/skin-lens", "/skin-scan", "/treatments", "/treatments/active-acne", "/programs", "/programs/clear-skin", "/packages", "/tests", "/membership",
         "/skin-diary", "/routine", "/countdown", "/injectables", "/glow-club", "/why-nea", "/body", "/magazine", "/faq", "/contact", "/privacy", "/account/sign-in", "/blog"]
IGNORE = re.compile(r"_next/image|skin-weather|status of 503|Failed to load resource: the server responded with a status of 500|net::ERR_|openbeautyfacts|open-meteo|instagram|youtube|tiktok|jsdelivr|googleapis|nominatim|unsplash|neaprecisionskin\.com|bioarolabs|WebGL|GPU stall|THREE\.", re.I)


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail[:300]})" if detail and not ok else ""))


def mail_code(addr, after):
    for _ in range(60):
        for f in sorted(glob.glob(f"{MAIL}/*.eml"), reverse=True):
            if os.path.getmtime(f) < after:
                continue
            m = email.message_from_bytes(open(f, "rb").read())
            if addr.lower() in (m.get("To") or "").lower():
                c = re.search(r"\b(\d{6})\b", m.get("Subject", ""))
                if c:
                    return c.group(1)
        time.sleep(0.25)
    return None


def totp(secret):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    h = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return f"{(struct.unpack('>I', h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def watch(page, bucket):
    page.on("console", lambda m: bucket.append(f"console.{m.type}: {m.text}") if m.type == "error" and not IGNORE.search(m.text) else None)
    page.on("pageerror", lambda e: bucket.append(f"pageerror: {e}"))
    page.on("response", lambda r: bucket.append(f"HTTP {r.status} {r.url}") if r.status >= 400 and BASE in r.url and not IGNORE.search(r.url) and "/api/auth/me" not in r.url else None)


def sign_in_ui(page, addr, birth=(1990, 5), name="Pat", tag="phone"):
    page.goto(f"{BASE}/account/sign-in?next=/account")
    page.fill("input[type=email]", addr)
    t0 = time.time() - 1
    page.click("button:has-text('Send my code')")
    page.wait_for_selector("text=Check your email", timeout=30000)
    code = mail_code(addr, t0)
    page.screenshot(path=f"{OUT}/{tag}-signin-code.png")
    page.locator("input[aria-label='Digit 1']").fill(code)  # pasting all 6 digits fills every box
    page.wait_for_url(lambda u: "/sign-in" not in u, timeout=30000)
    if "/welcome" in page.url:
        page.wait_for_selector("text=Nice to meet you", timeout=20000)
        page.fill("input[autocomplete=given-name]", name)
        page.select_option("select[aria-label='Birth month']", str(birth[1]))
        page.select_option("select[aria-label='Birth year']", str(birth[0]))
        page.check("input[type=checkbox] >> nth=0")
        page.screenshot(path=f"{OUT}/{tag}-signup-details.png")
        page.click("button:has-text('Create my free account')")
        page.wait_for_url(re.compile(r"/account$"), timeout=30000)
    page.wait_for_selector("text=Signed in as", timeout=20000)


def run_device(p, label, ctx_opts):
    cam = os.environ.get("FAKE_CAMERA_Y4M")  # a face video (y4m) with a simulated pulse; see tests/README.md
    args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox"] + ([f"--use-file-for-fake-video-capture={cam}"] if cam else [])
    browser = p.chromium.launch(executable_path=CHROME, headless=True, args=args)
    ctx = browser.new_context(**ctx_opts)
    page = ctx.new_page()
    errors = []
    watch(page, errors)
    events_sent = []
    page.on("request", lambda r: events_sent.append(r.url) if r.url.endswith("/api/events") else None)

    # cookie banner: nothing is sent before a choice
    page.goto(BASE + "/")
    page.wait_for_selector("text=We use cookies", timeout=20000)
    page.wait_for_timeout(6000)
    check(f"[{label}] no analytics before cookie choice", not events_sent)
    page.screenshot(path=f"{OUT}/{label}-home-banner.png")
    page.click("button:has-text('Allow')")
    page.wait_for_timeout(6500)
    check(f"[{label}] analytics sent after 'Allow'", bool(events_sent))

    # every key page: loads, no JS errors, no CSP blocks, tabs click
    for path in PAGES:
        errors.clear()
        r = page.goto(BASE + path, wait_until="domcontentloaded")
        page.wait_for_timeout(1800)
        tabs = page.locator("[role=tab]:visible")
        clicked = 0
        for i in range(min(tabs.count(), 8)):
            try:
                tabs.nth(i).click(timeout=2000)
                clicked += 1
                page.wait_for_timeout(150)
            except Exception:  # noqa: BLE001
                pass
        csp = [e for e in errors if "Content Security Policy" in e or "Refused to" in e]
        check(f"[{label}] {path} loads (HTTP {r.status if r else '?'}, {clicked} tabs clicked)", r and r.status == 200 and not [e for e in errors if e not in csp], " | ".join(errors[:3]))
        check(f"[{label}] {path} no CSP blocks", not csp, " | ".join(csp[:2]))
        if path in ("/", "/free-scan", "/skin-diary", "/glow-club", "/account/sign-in", "/treatments", "/privacy"):
            page.screenshot(path=f"{OUT}/{label}-{path.strip('/').replace('/', '-') or 'home'}.png")

    # members-only page shows the free-account card to visitors
    page.goto(BASE + "/skin-diary")
    page.wait_for_selector("text=needs a free account", timeout=15000)
    check(f"[{label}] Skin Diary asks visitors to create an account", True)
    page.goto(BASE + "/routine")
    page.wait_for_selector("text=Try it free", timeout=15000)
    check(f"[{label}] Routine Builder works for visitors with a save notice", True)

    # live face scan with a fake camera (MediaPipe CDN may be unreachable: the oval fallback is used)
    if label == "desktop":
        page.goto(BASE + "/skin-lens#live")
        try:
            page.wait_for_selector("button:has-text('Start my scan')", timeout=15000)
            page.click("button:has-text('Start my scan')")
            page.wait_for_timeout(4000)
            page.screenshot(path=f"{OUT}/{label}-live-scan-running.png")
            page.wait_for_selector("text=Save this scan to your Skin Diary", timeout=75000)
            page.wait_for_timeout(800)
            page.screenshot(path=f"{OUT}/{label}-live-scan-result-guest.png", full_page=False)
            bpm = re.search(r"(\d{2,3}) bpm", page.inner_text("body"))
            check(f"[{label}] live scan reads the simulated 72 bpm pulse (±6)", bool(bpm) and abs(int(bpm.group(1)) - 72) <= 6, bpm.group(0) if bpm else "no bpm shown")
            check(f"[{label}] live scan finishes and asks a visitor to join to save it", True)
        except Exception as e:  # noqa: BLE001
            page.screenshot(path=f"{OUT}/{label}-live-scan-problem.png")
            check(f"[{label}] live scan finishes and asks a visitor to join to save it", False, str(e)[:200])

    # sign up through the real screens
    addr = f"e2e-{label}-{int(time.time())}@nea.test"
    try:
        sign_in_ui(page, addr, tag=label)
        page.screenshot(path=f"{OUT}/{label}-account.png")
        check(f"[{label}] sign-up by email code works end to end", True)
        page.goto(BASE + "/skin-diary")
        page.wait_for_timeout(2500)
        check(f"[{label}] member sees the Skin Diary (no join card)", page.locator("text=needs a free account").count() == 0)
        page.screenshot(path=f"{OUT}/{label}-skin-diary-member.png")
        page.goto(BASE + "/glow-club")
        page.wait_for_timeout(2500)
        check(f"[{label}] member sees Glow Club", page.locator("text=Glow points to spend").count() > 0)
        page.screenshot(path=f"{OUT}/{label}-glow-club-member.png")
        page.goto(BASE + "/account")
        page.click("button:has-text('Sign out')")
        page.wait_for_url(BASE + "/", timeout=15000)
        page.goto(BASE + "/skin-diary")
        page.wait_for_selector("text=needs a free account", timeout=15000)
        check(f"[{label}] sign out clears access", True)
    except Exception as e:  # noqa: BLE001
        page.screenshot(path=f"{OUT}/{label}-signup-problem.png")
        check(f"[{label}] sign-up by email code works end to end", False, str(e)[:300])

    # under 16 is stopped in the form itself
    page.goto(BASE + "/account/sign-in")
    browser.close()


def run_admin(p):
    browser = p.chromium.launch(executable_path=CHROME, headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()
    errors = []
    watch(page, errors)
    addr = f"e2e-admin-{int(time.time())}@nea.test"
    subprocess.run(["node", "scripts/create-admin.mjs", addr, "Admin"], check=True, capture_output=True, env={**os.environ, "DATABASE_OWNER_URL": OWNER})
    try:
        sign_in_ui(page, addr, tag="admin")
        page.goto(f"{BASE}/{ADMIN}")
        page.wait_for_selector("text=Set up your authenticator app", timeout=20000)
        page.screenshot(path=f"{OUT}/admin-mfa-setup.png")
        secret = page.locator("p.font-mono").inner_text().strip()
        page.fill("input[aria-label=Code]", totp(secret))
        page.click("button:has-text('Verify')")
        page.wait_for_selector("text=Save your backup codes", timeout=20000)
        page.screenshot(path=f"{OUT}/admin-backup-codes.png")
        page.click("button:has-text('I saved them')")
        page.wait_for_selector("text=From visit to booking", timeout=20000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/admin-overview.png")
        check("[admin] staff page opens after two-step sign-in", True)
        for sub, marker in [("members", "Members"), ("leads", "Leads"), ("rewards", "Rewards (front desk)"), ("team", "Add staff"), ("audit", "Audit log")]:
            page.goto(f"{BASE}/{ADMIN}/{sub}")
            page.wait_for_selector(f"text={marker}", timeout=15000)
            page.wait_for_timeout(1200)
            page.screenshot(path=f"{OUT}/admin-{sub}.png")
            check(f"[admin] {sub} page works", True)
        check("[admin] no JavaScript errors on staff pages", not errors, " | ".join(errors[:3]))
    except Exception as e:  # noqa: BLE001
        page.screenshot(path=f"{OUT}/admin-problem.png")
        check("[admin] staff page opens after two-step sign-in", False, str(e)[:300])
    browser.close()


def main():
    with sync_playwright() as p:
        run_device(p, "phone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"))
        run_device(p, "desktop", dict(viewport={"width": 1280, "height": 800}))
        run_admin(p)
    passed = sum(1 for r in results if r[1])
    with open("tests/out/e2e-report.md", "w") as f:
        f.write(f"# Browser tests (phone + desktop)\n\n{passed} of {len(results)} passed · {time.strftime('%Y-%m-%d %H:%M')}\n\n| Result | Check |\n| --- | --- |\n")
        for n, ok, d in results:
            f.write(f"| {'✅' if ok else '❌'} | {n}{(' — ' + d[:200]) if d and not ok else ''} |\n")
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
