import { Suspense } from "react";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata = { title: "Reset password" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading">Opening password reset…</div>
      }
    >
      <AuthScreen mode="reset" />
    </Suspense>
  );
}
