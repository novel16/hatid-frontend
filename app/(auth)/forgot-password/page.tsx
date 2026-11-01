import { Suspense } from "react";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata = { title: "Recover account" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading">Opening account recovery…</div>
      }
    >
      <AuthScreen mode="forgot" />
    </Suspense>
  );
}
