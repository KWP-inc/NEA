"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Card, fmt, getJSON, sendJSON, useBase } from "./shell";

type Row = { id: string; name: string; email: string; role: string; status: string; marketing: boolean; club_code: string; created_at: string; scans: string; points: string };

export function Members() {
  const base = useBase();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    const t = setTimeout(() => getJSON<{ rows: Row[] }>(`/api/staff/members?q=${encodeURIComponent(q)}&page=${page}`).then((d) => setRows(d.rows)).catch(() => setRows([])), 250);
    return () => clearTimeout(t);
  }, [q, page]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Members</h1>
        <a href="/api/staff/members/export" className="btn-ghost !py-2 !text-[13px]">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>
      <label className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-2.5">
        <Search className="h-4 w-4 text-graphite" />
        <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="Search name, email or Glow Club code" className="w-full bg-transparent outline-none" />
      </label>
      <Card>
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px] [&_td]:pr-4 [&_th]:pr-4">
              <thead className="text-left text-graphite">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th className="text-right">Scans</th>
                  <th className="text-right">Points</th>
                  <th>Offers</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink/5">
                    <td className="py-2">
                      <Link href={`${base}/members/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                        {r.name || "—"}
                      </Link>
                      {r.role !== "member" && <span className="ml-2 rounded bg-ink/10 px-1.5 text-[11px]">{r.role}</span>}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.status === "pending_parent" ? "Waiting for parent" : r.status}</td>
                    <td className="tabular text-right">{r.scans}</td>
                    <td className="tabular text-right">{r.points}</td>
                    <td>{r.marketing ? "Yes" : "No"}</td>
                    <td>{fmt(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-6 text-center text-graphite">No members found.</p>}
          </div>
        )}
        <div className="mt-3 flex justify-between">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
            Previous
          </button>
          <button disabled={!rows || rows.length < 50} onClick={() => setPage(page + 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
            Next
          </button>
        </div>
      </Card>
    </div>
  );
}

type Detail = {
  user: { id: string; name: string; email: string; birth_ym: string; role: string; status: string; marketing: boolean; club_code: string; created_at: string; last_seen_at: string };
  scans: { score: number; bpm: number | null; taken_at: string; source: string }[];
  points: { kind: string; delta: number; label: string; created_at: string }[];
  rewards: { id: string; name: string; pts: number; code: string; created_at: string; used_at: string | null }[];
  consents: { kind: string; given: boolean; version: string; created_at: string }[];
  signIn: { provider: string }[];
};

export function MemberDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => getJSON<Detail>(`/api/staff/members/${id}`).then(setD).catch((e) => setErr(String(e.message)));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (err) return <p className="text-red-700">{err}</p>;
  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;
  const total = d.points.reduce((s, p) => s + p.delta, 0);
  const give = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await sendJSON("/api/staff/points", "POST", { userId: id, delta: Number(delta), reason });
      setDelta("");
      setReason("");
      setMsg("Points updated.");
      await load();
    } catch (e2) {
      setMsg(e2 instanceof Error ? e2.message : "Couldn't save.");
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.user.name || d.user.email}</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-graphite">Email</dt>
            <dd>{d.user.email}</dd>
            <dt className="text-graphite">Birth month</dt>
            <dd>{d.user.birth_ym || "—"}</dd>
            <dt className="text-graphite">Status</dt>
            <dd>{d.user.status}</dd>
            <dt className="text-graphite">Offers by email</dt>
            <dd>{d.user.marketing ? "Yes" : "No"}</dd>
            <dt className="text-graphite">Glow Club code</dt>
            <dd>{d.user.club_code}</dd>
            <dt className="text-graphite">Signs in with</dt>
            <dd>{d.signIn.map((s) => s.provider).join(", ")}</dd>
            <dt className="text-graphite">Joined</dt>
            <dd>{fmt(d.user.created_at)}</dd>
            <dt className="text-graphite">Last seen</dt>
            <dd>{fmt(d.user.last_seen_at)}</dd>
          </dl>
        </Card>
        <Card title={`Glow Club: ${total} points`}>
          <form onSubmit={give} className="flex flex-wrap gap-2">
            <input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" placeholder="+50 or -20" aria-label="Points" className="w-28 rounded-xl border border-ink/15 px-3 py-2" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. clinic visit)" aria-label="Reason" className="min-w-0 flex-1 rounded-xl border border-ink/15 px-3 py-2" />
            <button className="btn-primary !py-2">Save</button>
          </form>
          {msg && <p className="mt-2 text-[13px] text-flora">{msg}</p>}
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-[13px]">
            {d.points.map((p, i) => (
              <li key={i} className="flex justify-between border-t border-ink/5 pt-1">
                <span>
                  {p.label || p.kind} <span className="text-graphite">· {fmt(p.created_at)}</span>
                </span>
                <span className="tabular">{p.delta > 0 ? `+${p.delta}` : p.delta}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Scans (numbers only)">
          <ul className="max-h-64 space-y-1 overflow-y-auto text-[13px]">
            {d.scans.map((s, i) => (
              <li key={i} className="flex justify-between border-t border-ink/5 pt-1">
                <span>{fmt(s.taken_at)}</span>
                <span className="tabular">
                  score {s.score}
                  {s.bpm ? ` · ${s.bpm} bpm` : ""}
                </span>
              </li>
            ))}
            {!d.scans.length && <li className="text-graphite">No scans yet.</li>}
          </ul>
        </Card>
        <Card title="Consent history">
          <ul className="space-y-1 text-[13px]">
            {d.consents.map((c, i) => (
              <li key={i} className="flex justify-between border-t border-ink/5 pt-1">
                <span>
                  {c.kind} ({c.version})
                </span>
                <span>
                  {c.given ? "Yes" : "No"} · {fmt(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
