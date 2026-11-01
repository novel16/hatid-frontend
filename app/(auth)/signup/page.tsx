import { Suspense } from "react";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata = { title: "Create rider account" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="workspace-loading">Opening registration…</div>}
    >
      <AuthScreen mode="signup" />
    </Suspense>
  );
}
