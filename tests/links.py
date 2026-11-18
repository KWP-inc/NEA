#!/usr/bin/env python3
"""
Broken-link and SEO checker. Crawls every page in the sitemap plus every internal link it finds.

  BASE=http://localhost:3000 python3 tests/links.py

For each page: HTTP status, <title> (≤ 70 chars), meta description (50–170 chars), exactly one <h1>,
canonical, og:image, JSON-LD. For each internal link / image / script: it must load (no 404).
Old WordPress URLs must redirect. Writes tests/out/links-report.md. Exit 1 on any broken link or page.
"""
import os, re, sys, time, urllib.request, urllib.error
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

BASE = os.environ.get("BASE", "http://localhost:3000").rstrip("/")
HOST = urlparse(BASE).netloc


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.assets, self.h1, self.meta, self.title, self.in_title, self.jsonld, self.canonical = [], [], 0, {}, "", False, 0, ""

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag in ("img", "script", "source", "video") and a.get("src"):
            self.assets.append(a["src"])
        if tag == "link" and a.get("rel") in ("stylesheet", "icon", "manifest") and a.get("href"):
            self.assets.append(a["href"])
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href", "")
        if tag == "h1":
            self.h1 += 1
        if tag == "meta":
            k = a.get("name") or a.get("property")
            if k:
                self.meta[k] = a.get("content", "")
        if tag == "title":
            self.in_title = True
        if tag == "script" and a.get("type") == "application/ld+json":
            self.jsonld += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, d):
        if self.in_title:
            self.title += d


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def get(url, follow=True):
    req = urllib.request.Request(url, headers={"User-Agent": "nea-linkcheck", "X-Real-IP": "10.9.0.1"})
    try:
        r = (urllib.request.urlopen if follow else opener.open)(req, timeout=30)
        return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def main():
    st, _, xml = get(f"{BASE}/sitemap.xml")
    pages = [re.sub(r"^https?://[^/]+", "", u) or "/" for u in re.findall(r"<loc>([^<]+)</loc>", xml.decode())]
    queue, seen, problems, seo, checked_assets = list(dict.fromkeys(pages)), set(), [], [], {}
    while queue:
        path = queue.pop(0)
        if path in seen:
            continue
        seen.add(path)
        st, h, body = get(BASE + path)
        if st != 200:
            problems.append(f"page {path} → HTTP {st}")
            continue
        if "text/html" not in (h.get("Content-Type") or ""):
            continue
        p = P()
        p.feed(body.decode("utf-8", "replace"))
        desc = p.meta.get("description", "")
        issues = []
        if not p.title.strip():
            issues.append("no title")
        elif len(p.title) > 75:
            issues.append(f"title {len(p.title)} chars")
        if not desc:
            issues.append("no meta description")
        elif not 50 <= len(desc) <= 170:
            issues.append(f"description {len(desc)} chars")
        if p.h1 != 1:
            issues.append(f"{p.h1} h1 tags")
        if not p.meta.get("og:image"):
            issues.append("no og:image")
        if not p.canonical and not path.startswith("/account"):
            issues.append("no canonical")
        if p.jsonld == 0:
            issues.append("no JSON-LD")
        seo.append((path, p.title.strip(), len(desc), p.h1, issues))
        for href in p.links:
            if href.startswith(("mailto:", "tel:", "sms:", "#", "javascript:")):
                continue
            u = urlparse(urljoin(BASE + path, href))
            if u.netloc != HOST:
                continue
            target = u.path or "/"
            if target.startswith("/api/"):
                continue
            if target not in seen and target not in queue:
                queue.append(target)
        for src in p.assets:
            u = urlparse(urljoin(BASE + path, src))
            if u.netloc != HOST or src.startswith("data:"):
                continue
            key = u.path + ("?" + u.query if u.query else "")
            if key not in checked_assets:
                checked_assets[key] = get(BASE + key)[0]
                if checked_assets[key] not in (200, 204):
                    problems.append(f"asset {key} on {path} → HTTP {checked_assets[key]}")

    # old WordPress URLs must redirect
    redirects = ["/our-treatments-skin-health", "/fotona-laser", "/privacy-policy", "/frequently-asked-questions", "/consultation", "/wellness-packages"]
    for r in redirects:
        st, h, _ = get(BASE + r, follow=False)
        if st not in (301, 302, 307, 308):
            problems.append(f"old URL {r} → HTTP {st} (should redirect)")

    for path in ["/robots.txt", "/llms.txt", "/llms-full.txt", "/manifest.webmanifest", "/og/nea-share.jpg"]:
        st, _, _ = get(BASE + path)
        if st != 200:
            problems.append(f"{path} → HTTP {st}")

    os.makedirs("tests/out", exist_ok=True)
    seo_bad = [s for s in seo if s[4]]
    with open("tests/out/links-report.md", "w") as f:
        f.write(f"# Links and SEO check\n\n{time.strftime('%Y-%m-%d %H:%M')} · {len(seen)} pages crawled · {len(checked_assets)} files checked · {len(redirects)} old URLs\n\n")
        f.write(f"## Broken links and pages: {len(problems)}\n\n" + ("\n".join(f"- {p}" for p in problems) or "None.") + "\n\n")
        f.write(f"## SEO issues: {len(seo_bad)} pages\n\n" + ("\n".join(f"- `{s[0]}`: {', '.join(s[4])}" for s in seo_bad) or "None.") + "\n\n")
        f.write("## Every page\n\n| Page | Title | Description length | h1 |\n| --- | --- | --- | --- |\n")
        for s in seo:
            f.write(f"| `{s[0]}` | {s[1][:70]} | {s[2]} | {s[3]} |\n")
    print(f"{len(seen)} pages, {len(checked_assets)} files. Broken: {len(problems)}. SEO issues on {len(seo_bad)} pages.")
    for p in problems[:40]:
        print("  BROKEN", p)
    for s in seo_bad[:60]:
        print("  SEO", s[0], s[4])
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
