import "server-only";

/**
 * Server settings, read once. Every secret lives in the server environment only (.env.local in development,
 * the host's environment in production). Nothing here is ever sent to the browser.
 */
const isProd = process.env.NODE_ENV === "production";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server setting ${name}. See .env.example and DEPLOY.md.`);
  return v;
}

export const env = {
  isProd,
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  get databaseUrl() {
    return need("DATABASE_URL");
  },
  get authPepper() {
    return need("AUTH_PEPPER");
  },
  get sessionSecret() {
    return need("SESSION_SECRET");
  },
  get dataEncKey() {
    return need("DATA_ENC_KEY");
  },
  get altchaKey() {
    return need("ALTCHA_HMAC_KEY");
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "NEA Precision Skin <no-reply@neaprecisionskin.com>",
  },
  google: { id: process.env.GOOGLE_CLIENT_ID || "", secret: process.env.GOOGLE_CLIENT_SECRET || "" },
  apple: {
    id: process.env.APPLE_CLIENT_ID || "",
    team: process.env.APPLE_TEAM_ID || "",
    keyId: process.env.APPLE_KEY_ID || "",
    key: (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
  adminPath: (process.env.ADMIN_PATH || "").replace(/[^a-zA-Z0-9-]/g, ""),
  cronSecret: process.env.CRON_SECRET || "",
  leadWebhook: process.env.LEAD_WEBHOOK_URL || "",
  leadWebhookSecret: process.env.LEAD_WEBHOOK_SECRET || "",
  staffNotify: process.env.STAFF_NOTIFY_EMAIL || "",
};

export const hasGoogle = () => Boolean(env.google.id && env.google.secret);
export const hasApple = () => Boolean(env.apple.id && env.apple.team && env.apple.keyId && env.apple.key);
export const hasDb = () => Boolean(process.env.DATABASE_URL);

/**
 * Without an email server, sign-in codes are printed in the server terminal instead of emailed.
 * Always on in `npm run dev`. For `npm start` on your own computer set EMAIL_TO_CONSOLE=1.
 * Never set EMAIL_TO_CONSOLE on the real server.
 */
export const emailToConsole = () => !env.isProd || process.env.EMAIL_TO_CONSOLE === "1";

/** Settings still missing before member accounts can work (empty = ready). */
export function accountsMissing() {
  const missing: string[] = [];
  if (!hasDb()) missing.push("DATABASE_URL");
  for (const k of ["AUTH_PEPPER", "SESSION_SECRET", "ALTCHA_HMAC_KEY"]) if (!process.env[k]) missing.push(k);
  if (!process.env.SMTP_HOST && !emailToConsole()) missing.push("SMTP_HOST (or EMAIL_TO_CONSOLE=1 for testing on your own computer)");
  return missing;
}

/** Member accounts need a database, the secrets, and a way to send sign-in codes. */
export const accountsReady = () => accountsMissing().length === 0;
