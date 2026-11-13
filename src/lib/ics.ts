/** Builds a calendar file (.ics) of all-day reminders and hands it to the visitor. Works with Apple, Google and Outlook calendars. */
export type Reminder = { date: Date; title: string; note?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function buildIcs(items: Reminder[], stamp = new Date()): string {
  const now = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NEA Precision Skin//My Glow//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  items.forEach((it, i) => {
    const end = new Date(it.date);
    end.setDate(end.getDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:${ymd(it.date)}-${i}-${now}@neaprecisionskin.com`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${ymd(it.date)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${esc(it.title)}`);
    if (it.note) lines.push(`DESCRIPTION:${esc(it.note)}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(it.title)}`, "TRIGGER:PT9H", "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(name: string, items: Reminder[]) {
  const url = URL.createObjectURL(new Blob([buildIcs(items)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".ics") ? name : `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A date like "Sat, Nov 14". */
export const shortDate = (d: Date) => d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
export const longDate = (d: Date) => d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
