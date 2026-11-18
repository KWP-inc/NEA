import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Numbers for the staff dashboard: members, leads, scans, and the scan → account → Book funnel. */
export const GET = api({ auth: "staff", limit: ["staff", 120] }, async (req, s) => {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") || 30)));
  const data = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const [totals] = await q<Record<string, string>>(
      `SELECT
         (SELECT count(*) FROM users WHERE role = 'member' AND status = 'active') AS members,
         (SELECT count(*) FROM users WHERE created_at > now() - make_interval(days => $1)) AS new_members,
         (SELECT count(*) FROM users WHERE status = 'pending_parent') AS waiting_parent,
         (SELECT count(*) FROM leads WHERE created_at > now() - make_interval(days => $1)) AS leads,
         (SELECT count(*) FROM scans WHERE taken_at > now() - make_interval(days => $1)) AS scans,
         (SELECT count(*) FROM redemptions WHERE used_at IS NULL) AS open_rewards`,
      [days],
    );
    const funnel = await q<{ name: string; visitors: string; events: string }>(
      `SELECT name, count(DISTINCT anon_id) AS visitors, count(*) AS events FROM activity_events
        WHERE created_at > now() - make_interval(days => $1)
          AND name IN ('page_view', 'scan_start', 'scan_finish', 'join_prompt_click', 'signup_finish', 'book_click', 'lead_submit', 'si_open')
        GROUP BY name`,
      [days],
    );
    const pages = await q<{ path: string; views: string }>(
      `SELECT path, count(*) AS views FROM activity_events WHERE name = 'page_view' AND created_at > now() - make_interval(days => $1) GROUP BY path ORDER BY views DESC LIMIT 12`,
      [days],
    );
    const sources = await q<{ source: string; visitors: string }>(
      `SELECT coalesce(nullif(utm->>'utm_source', ''), CASE WHEN referrer IS NULL OR referrer = '' THEN 'direct' ELSE split_part(split_part(referrer, '://', 2), '/', 1) END) AS source,
              count(DISTINCT anon_id) AS visitors
         FROM activity_events WHERE name = 'page_view' AND created_at > now() - make_interval(days => $1)
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      [days],
    );
    const daily = await q<{ day: string; visitors: string; books: string }>(
      `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, count(DISTINCT anon_id) FILTER (WHERE name = 'page_view') AS visitors, count(*) FILTER (WHERE name = 'book_click') AS books
         FROM activity_events WHERE created_at > now() - make_interval(days => $1) GROUP BY 1 ORDER BY 1`,
      [days],
    );
    const devices = await q<{ device: string; visitors: string }>(
      `SELECT coalesce(device, 'unknown') AS device, count(DISTINCT anon_id) AS visitors FROM activity_events WHERE created_at > now() - make_interval(days => $1) GROUP BY 1`,
      [days],
    );
    return { totals, funnel, pages, sources, daily, devices };
  });
  return json({ days, ...data });
});
