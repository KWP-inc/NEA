import { Suspense } from "react";
import { SignInFlow } from "@/components/account/sign-in-flow";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<div className="surface mx-auto h-80 max-w-md animate-pulse rounded-[32px]" aria-hidden />}>
      <SignInFlow />
    </Suspense>
  );
}
