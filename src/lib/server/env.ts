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

/** Member accounts need a database and a way to email sign-in codes (in development the code is printed instead). */
export const accountsReady = () =>
  hasDb() && Boolean(process.env.AUTH_PEPPER && process.env.SESSION_SECRET && process.env.ALTCHA_HMAC_KEY) && (Boolean(process.env.SMTP_HOST) || !env.isProd);
