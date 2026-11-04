import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceAccess } from "@/components/providers";
import { ParcelEntryProvider } from "@/features/parcels/parcel-entry-screen";

export const instant = false;

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading">
          Getting your rider workspace ready…
        </div>
      }
    >
      <WorkspaceAccess>
        <ParcelEntryProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </ParcelEntryProvider>
      </WorkspaceAccess>
    </Suspense>
  );
}
