import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceAccess } from "@/components/providers";
import { ParcelEntryProvider } from "@/features/parcels/parcel-entry-screen";
import { NotificationsProvider } from "@/features/settings/account-notifications";
import { RecoveryProvider } from "@/features/settings/account-recovery";
import { DemoNotificationContent } from "@/features/settings/workspace-settings";

export const instant = false;

/** Share account-scoped parcel and notification state only inside the verified workspace. */
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
        <NotificationsProvider demoContent={<DemoNotificationContent />}>
          <RecoveryProvider>
            <ParcelEntryProvider>
              <WorkspaceShell>{children}</WorkspaceShell>
            </ParcelEntryProvider>
          </RecoveryProvider>
        </NotificationsProvider>
      </WorkspaceAccess>
    </Suspense>
  );
}
