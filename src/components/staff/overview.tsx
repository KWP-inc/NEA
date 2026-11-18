"use client";
import { useEffect, useState } from "react";
import { Card, getJSON } from "./shell";

type Stats = {
  days: number;
  totals: Record<string, string>;
  funnel: { name: string; visitors: string; events: string }[];
  pages: { path: string; views: string }[];
  sources: { source: string; visitors: string }[];
  daily: { day: string; visitors: string; books: string }[];
  devices: { device: string; visitors: string }[];
};

const STEPS: [string, string][] = [
  ["page_view", "Visited"],
  ["scan_start", "Started a face scan"],
  ["scan_finish", "Finished a scan"],
  ["join_prompt_click", "Tapped 'Create account'"],
  ["signup_finish", "Created an account"],
  ["book_click", "Tapped Book"],
  ["lead_submit", "Sent a form"],
];

export function Overview() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setD(null);
    getJSON<Stats>(`/api/staff/stats?days=${days}`).then(setD).catch((e) => setErr(String(e.message)));
  }, [days]);
  if (err) return <p className="text-red-700">{err}</p>;
  const n = (k: string) => Number(d?.totals?.[k] ?? 0).toLocaleString("en-CA");
  const step = (name: string) => Number(d?.funnel.find((f) => f.name === name)?.visitors ?? 0);
  const top = Math.max(1, step("page_view"));
  const maxDay = Math.max(1, ...(d?.daily.map((x) => Number(x.visitors)) ?? [1]));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="flex gap-1 rounded-full bg-ink/5 p-1 text-[13px]">
          {[7, 30, 90].map((x) => (
            <button key={x} onClick={() => setDays(x)} className={`rounded-full px-3 py-1 ${days === x ? "bg-ink text-white" : ""}`}>
              {x} days
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["members", "Active members"],
          ["new_members", "New accounts"],
          ["waiting_parent", "Waiting for parent"],
          ["leads", "Form requests"],
          ["scans", "Scans saved"],
          ["open_rewards", "Rewards to honour"],
        ].map(([k, label]) => (
          <Card key={k}>
            <p className="text-[12.5px] text-graphite">{label}</p>
            <p className="tabular mt-1 text-[1.8rem] font-semibold">{d ? n(k) : "…"}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="From visit to booking (people)">
          <ul className="space-y-2">
            {STEPS.map(([k, label]) => (
              <li key={k}>
                <div className="flex justify-between text-[13.5px]">
                  <span>{label}</span>
                  <span className="tabular">{step(k).toLocaleString("en-CA")}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ink/5">
                  <div className="h-2 rounded-full bg-flora" style={{ width: `${Math.max(1, (step(k) / top) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-graphite">Only visitors who allowed analytics are counted.</p>
        </Card>
        <Card title="Visitors per day">
          <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Visitors per day">
            {d?.daily.map((x) => (
              <div key={x.day} title={`${x.day}: ${x.visitors} visitors, ${x.books} Book taps`} className="flex-1 rounded-t bg-flora/70" style={{ height: `${(Number(x.visitors) / maxDay) * 100}%` }} />
            ))}
          </div>
        </Card>
        <Card title="Top pages">
          <table className="w-full text-[13.5px]">
            <tbody>
              {d?.pages.map((p) => (
                <tr key={p.path} className="border-t border-ink/5">
                  <td className="py-1.5">{p.path}</td>
                  <td className="tabular py-1.5 text-right">{p.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Where visitors came from">
          <table className="w-full text-[13.5px]">
            <tbody>
              {d?.sources.map((p) => (
                <tr key={p.source} className="border-t border-ink/5">
                  <td className="py-1.5">{p.source}</td>
                  <td className="tabular py-1.5 text-right">{p.visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-graphite">Devices: {d?.devices.map((x) => `${x.device} ${x.visitors}`).join(" · ")}</p>
        </Card>
      </div>
    </div>
  );
}
