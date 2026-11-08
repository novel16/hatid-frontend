import { Suspense } from "react";
import { DeliveriesScreen } from "@/features/deliveries/deliveries-screen";
export const metadata = { title: "Deliveries" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return (
    <Suspense
      fallback={<div className="workspace-loading">Opening deliveries…</div>}
    >
      <DeliveriesScreen />
    </Suspense>
  );
}
