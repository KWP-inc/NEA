#!/usr/bin/env node
/**
 * Load test (autocannon). Run against a production build (npm run build && npm start), never against `next dev`.
 *   BASE=http://localhost:3000 node tests/load.mjs
 * Targets (docs/Architecture.md): public pages p95 < 800 ms at 200 users; light API p95 < 300 ms.
 * Each simulated request uses its own IP so the per-visitor rate limit doesn't hide the real speed.
 */
import autocannon from "autocannon";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const SECONDS = Number(process.env.SECONDS || 20);
let n = 0;
const ip = () => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n++ & 255}`;

const scenarios = [
  { name: "Home page", path: "/", connections: 200, target: 800 },
  { name: "Treatment page", path: "/treatments/active-acne", connections: 200, target: 800 },
  { name: "Free scan page (poster QR)", path: "/free-scan", connections: 200, target: 800 },
  { name: "Health check (app + database)", path: "/api/health", connections: 100, target: 300 },
  { name: "Who am I (signed out)", path: "/api/auth/me", connections: 100, target: 300 },
  { name: "Captcha puzzle", path: "/api/auth/captcha", connections: 50, target: 300 },
];

const rows = [];
for (const s of scenarios) {
  const r = await autocannon({
    url: BASE + s.path,
    connections: s.connections,
    duration: SECONDS,
    requests: [{ setupRequest: (req) => ({ ...req, headers: { ...req.headers, "x-real-ip": ip() } }) }],
  });
  const p95 = r.latency.p97_5 ?? r.latency.p99;
  const p50 = r.latency.p50;
  // failed answers = HTTP errors + timeouts. Socket errors from connections cut at the very end of the run are listed apart.
  const errors = r.timeouts + (r.non2xx || 0);
  const socket = r.errors;
  const ok = p95 <= s.target && errors === 0;
  rows.push({ ...s, rps: Math.round(r.requests.average), total: r.requests.total, p50, p95, errors, socket, ok });
  console.log(`${ok ? "PASS" : "WARN"} ${s.name}: ${Math.round(r.requests.average)} req/s, p50 ${p50} ms, p97.5 ${p95} ms, failed ${errors}, socket ${socket} of ${r.requests.total} (target p95 < ${s.target} ms)`);
}
await mkdir("tests/out", { recursive: true });
await writeFile(
  "tests/out/load-report.md",
  `# Load test\n\n${new Date().toISOString().slice(0, 16)} · ${SECONDS}s per scenario · ${BASE}\n\n| Scenario | Users at once | Requests/s | Requests | Median | p97.5 | Failed | Target | Result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n` +
    rows.map((r) => `| ${r.name} | ${r.connections} | ${r.rps} | ${r.total} | ${r.p50} ms | ${r.p95} ms | ${r.errors} | < ${r.target} ms | ${r.ok ? "✅" : "⚠️"} |`).join("\n") +
    "\n",
);
