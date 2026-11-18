import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { StaffShell } from "@/components/staff/shell";

/**
 * The staff page. Reached only through the secret ADMIN_PATH (see middleware). Anyone who isn't signed in
 * as staff or admin gets a normal 404 page, so it looks like nothing is here.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.user.status !== "active" || (s.user.role !== "staff" && s.user.role !== "admin") || !env.adminPath) notFound();
  return (
    <StaffShell base={`/${env.adminPath}`} role={s.user.role} mfaOk={s.mfaOk} email={s.user.email}>
      {children}
    </StaffShell>
  );
}
