import { notFound } from "next/navigation";
import { MemberDetail } from "@/components/staff/members";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <MemberDetail id={id} />;
}
