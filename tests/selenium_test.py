"""
Selenium browser test (a second, independent driver next to the Playwright test in e2e.py).

Checks on an iPhone-size screen and a computer screen:
  - every main page opens with HTTP 200 and a title, no JavaScript errors
  - header, footer and the bottom dock show; phone number is the new one
  - nothing small (a photo) stays pinned on the phone screen while scrolling
  - Sign in and Create account tabs both exist on the sign-in page
  - treatment text that was missing is back (Perfect Peel, Large Pores plan, Rosacea wording)
  - the Glow Feed opens as a vertical swipe feed on the phone

Run:   python3 tests/selenium_test.py            (site on http://localhost:3000)
       BASE=https://example.com python3 tests/selenium_test.py
Needs: pip install selenium chromedriver-py   and Chrome (chromedriver-py's version must match Chrome's).
"""
import os
import sys
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE = os.environ.get("BASE", "http://localhost:3000").rstrip("/")
OUT = "tests/out"
os.makedirs(OUT, exist_ok=True)
PAGES = ["/", "/treatments", "/treatments/facials", "/treatments/large-pores", "/treatments/rosacea", "/programs", "/packages",
         "/skin-lens", "/free-scan", "/membership", "/about", "/gallery", "/blog", "/newsletters", "/magazine", "/faq", "/contact",
         "/account/sign-in", "/privacy", "/terms"]
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))


def driver(phone):
    o = Options()
    o.binary_location = os.environ.get("CHROME", "/usr/bin/google-chrome")
    for a in ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"]:
        o.add_argument(a)
    if phone:
        o.add_experimental_option("mobileEmulation", {
            "deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2, "touch": True, "mobile": True},
            "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        })
    else:
        o.add_argument("--window-size=1280,860")
    o.set_capability("goog:loggingPrefs", {"browser": "SEVERE"})
    # chromedriver must match Chrome's version. `pip install chromedriver-py==<your Chrome version>` gives one.
    try:
        from chromedriver_py import binary_path
        return webdriver.Chrome(options=o, service=Service(binary_path))
    except ImportError:
        return webdriver.Chrome(options=o)


def js_errors(d):
    skip = ("_next/image", "neaprecisionskin.com", "instagram", "open-meteo", "skin-weather", "jsdelivr", "googleapis", "favicon", "ERR_", "status of 50")
    return [e["message"] for e in d.get_log("browser") if not any(s in e["message"] for s in skip)]


def run(label, phone):
    d = driver(phone)
    w = WebDriverWait(d, 20)
    try:
        for path in PAGES:
            d.get(BASE + path)
            w.until(lambda x: x.execute_script("return document.readyState") == "complete")
            time.sleep(0.8)
            status = d.execute_script("return performance.getEntriesByType('navigation')[0]?.responseStatus || 200")
            errs = js_errors(d)
            check(f"[{label}] {path} opens (HTTP {status}) with a title, no JS errors", status == 200 and d.title and not errs, " | ".join(errs[:2]))

        d.get(BASE + "/")
        time.sleep(1.5)
        html = d.page_source
        check(f"[{label}] new phone number 825-395-3349 is shown", "825-395-3349" in html)
        check(f"[{label}] old phone number is gone", "587-892-5722" not in html)
        check(f"[{label}] footer is there", len(d.find_elements(By.TAG_NAME, "footer")) > 0)
        d.save_screenshot(f"{OUT}/selenium-{label}-home.png")

        d.get(BASE + "/account/sign-in")
        w.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[role=tab]")))
        tabs = [t.text for t in d.find_elements(By.CSS_SELECTOR, "[role=tab]")]
        check(f"[{label}] sign-in page has 'Sign in' and 'Create account' tabs", any("Sign in" in t for t in tabs) and any("Create account" in t for t in tabs), str(tabs))
        d.find_element(By.XPATH, "//button[@role='tab'][contains(., 'Create account')]").click()
        time.sleep(0.4)
        check(f"[{label}] 'Create account' tab changes the heading", "Create your free account" in d.page_source)
        d.save_screenshot(f"{OUT}/selenium-{label}-sign-in.png")

        d.get(BASE + "/treatments/facials")
        time.sleep(1)
        peel = d.find_element(By.XPATH, "//button[contains(., 'The Perfect Peel')]")
        d.execute_script("arguments[0].scrollIntoView({block:'center'})", peel)
        peel.click()  # it sits in a fold like the other facials; a visitor taps it open
        time.sleep(0.8)
        d.save_screenshot(f"{OUT}/selenium-{label}-perfect-peel.png")
        body = d.find_element(By.TAG_NAME, "body").text
        check(f"[{label}] Facials: The Perfect Peel text is there", "medical-grade chemical peel" in body and "trichloroacetic acid" in body)
        d.get(BASE + "/treatments/large-pores")
        time.sleep(1)
        check(f"[{label}] Large Pores: full treatment plan is there", "Your plan can include" in d.find_element(By.TAG_NAME, "body").text)
        d.get(BASE + "/treatments/rosacea")
        time.sleep(1)
        rb = d.find_element(By.TAG_NAME, "body").text.lower()
        check(f"[{label}] Rosacea is called a skin condition, not a disease", "skin condition" in rb and "skin disease" not in rb)

        if phone:
            d.get(BASE + "/")
            time.sleep(1.5)
            pinned = d.execute_script("""
                return [...document.querySelectorAll('main *')].filter(el => getComputedStyle(el).position === 'sticky'
                  && el.offsetParent && el.querySelector('img,canvas,video') && !String(el.className).includes('bg-[#140e10]')).length""")
            check("[phone] no small photo pinned while scrolling", pinned == 0, f"{pinned} pinned")
            # scroll the whole page top to bottom in steps: the page must keep moving (no freeze)
            last, moved = -1, 0
            for _ in range(25):
                d.execute_script("window.scrollBy(0, 900)")
                time.sleep(0.15)
                y = d.execute_script("return window.scrollY")
                moved += y != last
                last = y
            check("[phone] page scrolls smoothly from top to bottom", moved >= 10, f"moved {moved} of 25 steps")
            btn = d.find_element(By.XPATH, "//button[contains(., 'Watch all videos')]")
            d.execute_script("arguments[0].scrollIntoView({block:'center'})", btn)
            time.sleep(0.5)
            btn.click()
            w.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[role=dialog][aria-label='Glow Feed'] section[data-i]")))
            time.sleep(1.5)
            d.save_screenshot(f"{OUT}/selenium-phone-glow-feed.png")
            items = len(d.find_elements(By.CSS_SELECTOR, "[role=dialog] section[data-i]"))
            check("[phone] Glow Feed opens as a vertical swipe feed", items > 1, f"{items} videos")
    except Exception as e:  # noqa: BLE001
        d.save_screenshot(f"{OUT}/selenium-{label}-problem.png")
        check(f"[{label}] test finished without a crash", False, str(e)[:300])
    finally:
        d.quit()


if __name__ == "__main__":
    run("phone", True)
    run("desktop", False)
    passed = sum(1 for r in results if r[1])
    with open(f"{OUT}/selenium-report.md", "w") as f:
        f.write(f"# Selenium tests (phone + desktop)\n\n{passed} of {len(results)} passed · {time.strftime('%Y-%m-%d %H:%M')}\n\n| Result | Check |\n| --- | --- |\n")
        for n, ok, dd in results:
            f.write(f"| {'✅' if ok else '❌'} | {n}{(' — ' + dd[:200]) if dd and not ok else ''} |\n")
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)
