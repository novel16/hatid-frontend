import { Suspense } from "react";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata = { title: "Sign in" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="workspace-loading">Opening sign in…</div>}
    >
      <AuthScreen mode="login" />
    </Suspense>
  );
}
