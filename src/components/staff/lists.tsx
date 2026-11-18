"use client";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card, fmt, getJSON, sendJSON } from "./shell";

type Lead = { id: string; kind: string; name: string; email: string | null; phone: string | null; message: string | null; meta: Record<string, unknown>; created_at: string };

export function Leads() {
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    setRows(null);
    getJSON<{ rows: Lead[] }>(`/api/staff/leads?kind=${kind}&page=${page}`).then((d) => setRows(d.rows)).catch(() => setRows([]));
  }, [kind, page]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => (setKind(e.target.value), setPage(0))} className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-[13px]" aria-label="Form type">
            <option value="">All forms</option>
            {["skin-scan", "consultation", "contact", "partner", "magazine", "experience"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <a href="/api/staff/leads/export" className="btn-ghost !py-2 !text-[13px]">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>
      {!rows ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="grid gap-3">
          {rows.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap justify-between gap-2 text-[14px]">
                <p className="font-medium">
                  {l.name} <span className="ml-2 rounded bg-flora-soft px-2 py-0.5 text-[12px] text-flora">{l.kind}</span>
                </p>
                <p className="text-graphite">{fmt(l.created_at)}</p>
              </div>
              <p className="mt-1 text-[14px]">
                {l.email && (
                  <a href={`mailto:${l.email}`} className="underline">
                    {l.email}
                  </a>
                )}
                {l.email && l.phone && " · "}
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="underline">
                    {l.phone}
                  </a>
                )}
              </p>
              {l.message && <p className="mt-2 whitespace-pre-wrap text-[14px] text-graphite">{l.message}</p>}
              <p className="mt-2 text-[12.5px] text-graphite">
                {Object.entries(l.meta)
                  .filter(([, v]) => v !== "" && v !== undefined)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ")}
              </p>
            </Card>
          ))}
          {!rows.length && <p className="text-graphite">No leads yet.</p>}
          <div className="flex justify-between">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
              Previous
            </button>
            <button disabled={rows.length < 50} onClick={() => setPage(page + 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Reward = { id: string; name: string; pts: number; code: string; created_at: string; used_at: string | null; member: string; email: string };

export function Rewards() {
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<Reward[] | null>(null);
  const [msg, setMsg] = useState("");
  const load = (c = code) => getJSON<{ rows: Reward[] }>(`/api/staff/redemptions?code=${encodeURIComponent(c)}`).then((d) => setRows(d.rows)).catch(() => setRows([]));
  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const use = async (id: string) => {
    setMsg("");
    try {
      await sendJSON("/api/staff/redemptions", "POST", { id });
      setMsg("Marked as used.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save.");
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rewards (front desk)</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex gap-2"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Reward code, e.g. A1B2C3-XY7Z" aria-label="Reward code" className="min-w-0 flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-2.5 uppercase" />
        <button className="btn-primary !py-2">Find</button>
      </form>
      {msg && <p className="text-[14px] text-flora">{msg}</p>}
      <Card>
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ul className="space-y-2 text-[14px]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-2">
                <span>
                  <strong>{r.code}</strong> · {r.name} ({r.pts} pts) · {r.member || r.email}
                  <span className="text-graphite"> · {fmt(r.created_at)}</span>
                </span>
                {r.used_at ? (
                  <span className="text-graphite">Used {fmt(r.used_at)}</span>
                ) : (
                  <button onClick={() => use(r.id)} className="btn-ghost !py-1.5 !text-[13px]">
                    Mark used
                  </button>
                )}
              </li>
            ))}
            {!rows.length && <li className="text-graphite">No open rewards.</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}

type StaffRow = { id: string; name: string; email: string; role: string; status: string; last_seen_at: string | null; mfa: boolean };

export function Team() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [msg, setMsg] = useState("");
  const load = () => getJSON<{ rows: StaffRow[] }>("/api/staff/team").then((d) => setRows(d.rows)).catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, []);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setMsg("");
    try {
      await fn();
      setMsg(done);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save.");
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <Card title="Add staff">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => sendJSON("/api/staff/team", "POST", { email, name, role }), `Added. ${email} can now sign in with their email code and set up two-step sign-in.`).then(() => (setEmail(""), setName("")));
          }}
          className="flex flex-wrap gap-2"
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="email@neaskincare.com" aria-label="Email" className="min-w-0 flex-1 rounded-xl border border-ink/15 px-3 py-2" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className="w-40 rounded-xl border border-ink/15 px-3 py-2" />
          <select value={role} onChange={(e) => setRole(e.target.value as "staff" | "admin")} aria-label="Role" className="rounded-xl border border-ink/15 px-3 py-2">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn-primary !py-2">Add</button>
        </form>
        {msg && <p className="mt-2 text-[13px] text-flora">{msg}</p>}
      </Card>
      <Card>
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ul className="space-y-2 text-[14px]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-2">
                <span>
                  <strong>{r.name || r.email}</strong> · {r.email} · {r.role} · two-step {r.mfa ? "on" : "not set up"}
                  <span className="text-graphite"> · last seen {fmt(r.last_seen_at)}</span>
                </span>
                <span className="flex gap-1">
                  <button onClick={() => act(() => sendJSON("/api/staff/team", "PATCH", { id: r.id, resetMfa: true }), "Two-step sign-in reset.")} className="btn-ghost !px-3 !py-1 !text-[12.5px]">
                    Reset two-step
                  </button>
                  <button onClick={() => act(() => sendJSON("/api/staff/team", "PATCH", { id: r.id, role: "member" }), "Staff access removed.")} className="btn-ghost !px-3 !py-1 !text-[12.5px]">
                    Remove access
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type AuditRow = { id: string; action: string; target: string | null; detail: Record<string, unknown>; ip: string; created_at: string; staff: string | null };

export function Audit() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setRows(null);
    getJSON<{ rows: AuditRow[] }>(`/api/staff/audit?page=${page}`).then((d) => setRows(d.rows)).catch(() => setRows([]));
  }, [page]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="text-[14px] text-graphite">Every staff change, kept for good. Nobody can edit or delete these rows from the website.</p>
      <Card>
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px] [&_td]:pr-4 [&_th]:pr-4">
              <thead className="text-left text-graphite">
                <tr>
                  <th className="py-2">When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink/5 align-top">
                    <td className="py-1.5">{fmt(r.created_at)}</td>
                    <td>{r.staff ?? "—"}</td>
                    <td>{r.action}</td>
                    <td className="max-w-xs break-words font-mono text-[12px]">{JSON.stringify(r.detail)}</td>
                    <td>{r.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex justify-between">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
            Newer
          </button>
          <button disabled={!rows || rows.length < 100} onClick={() => setPage(page + 1)} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-40">
            Older
          </button>
        </div>
      </Card>
    </div>
  );
}
