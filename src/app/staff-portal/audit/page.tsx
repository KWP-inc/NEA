import { notFound } from "next/navigation";
import { Audit } from "@/components/staff/lists";
import { getSession } from "@/lib/server/auth";

export default async function Page() {
  const s = await getSession();
  if (s?.user.role !== "admin") notFound();
  return <Audit />;
}
