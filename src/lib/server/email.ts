import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

/**
 * Sends email through NEA's own SMTP server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).
 * In development without SMTP, the email is printed to the server console instead.
 */
let tx: Transporter | null = null;

function transport() {
  if (!tx) {
    tx = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      pool: true,
      maxConnections: 3,
    });
  }
  return tx;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function wrap(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#fdfbfc;font-family:Inter,Arial,sans-serif;color:#1f1a24">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#b0396b;margin:0 0 12px">NEA Precision Skin</p>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
<p style="font-size:12px;color:#625868;margin-top:32px">#104, 3151 27 Street NE, Calgary · 825-395-3349<br>You got this email because someone used this address on neaprecisionskin.com.</p>
</div></body></html>`;
}

export async function sendMail(to: string, subject: string, title: string, bodyHtml: string, text: string) {
  if (!env.smtp.host) {
    if (env.isProd) throw new Error("SMTP is not set up");
    console.info(`\n[dev email] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  await transport().sendMail({ from: env.smtp.from, to, subject, text, html: wrap(title, bodyHtml) });
}

export const mailCode = (to: string, code: string) =>
  sendMail(
    to,
    `${code} is your NEA sign-in code`,
    "Your sign-in code",
    `<p style="font-size:15px">Type this code on the website. It works for 10 minutes.</p>
     <p style="font-size:34px;letter-spacing:.3em;font-weight:600;margin:20px 0">${esc(code)}</p>
     <p style="font-size:13px;color:#625868">If you didn't ask for this, you can ignore this email.</p>`,
    `Your NEA sign-in code is ${code}. It works for 10 minutes. If you didn't ask for it, ignore this email.`,
  );

export const mailParent = (to: string, childName: string, link: string) =>
  sendMail(
    to,
    "Your child wants a free NEA account",
    "Please say yes (or no)",
    `<p style="font-size:15px">${esc(childName || "Your child")} wants a free account on the NEA Precision Skin website, to save their skin scans and earn Glow Club points.</p>
     <p style="font-size:15px">They are under 18, so we need a parent to agree first. Nothing is saved until you do.</p>
     <p style="margin:24px 0"><a href="${esc(link)}" style="background:#b0396b;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:600">Review and decide</a></p>
     <p style="font-size:13px;color:#625868">The link works for 7 days. If you do nothing, the account is deleted.</p>`,
    `${childName || "Your child"} wants a free NEA Precision Skin account. They are under 18, so a parent must agree first. Review it here (7 days): ${link}`,
  );

export const mailStaffInvite = (to: string, link: string) =>
  sendMail(
    to,
    "You've been added as NEA staff",
    "Welcome to the NEA staff page",
    `<p style="font-size:15px">Sign in with this email address, then set up two-step sign-in with an authenticator app.</p>
     <p style="margin:24px 0"><a href="${esc(link)}" style="background:#b0396b;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:600">Open the staff page</a></p>`,
    `You've been added as NEA staff. Open: ${link}`,
  );
