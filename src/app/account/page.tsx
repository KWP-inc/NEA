import { AccountHome } from "@/components/account/account-home";
import { getSession } from "@/lib/server/auth";
import { env } from "@/lib/server/env";

export const metadata = { title: "Your account" };

export default async function Page() {
  // the staff link is only rendered for staff; everyone else never sees the hidden path
  const s = await getSession().catch(() => null);
  const staffHref = s && (s.user.role === "staff" || s.user.role === "admin") && env.adminPath ? `/${env.adminPath}` : null;
  return (
    <div className="mx-auto max-w-4xl">
      <AccountHome staffHref={staffHref} />
    </div>
  );
}
