import { Suspense } from "react";
import { WelcomeForm } from "@/components/account/welcome-form";

export const metadata = { title: "Create your account" };

export default function Page() {
  return (
    <Suspense fallback={<div className="surface mx-auto h-80 max-w-md animate-pulse rounded-[32px]" aria-hidden />}>
      <WelcomeForm />
    </Suspense>
  );
}
