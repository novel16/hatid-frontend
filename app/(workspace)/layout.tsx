import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceAccess } from "@/components/providers";

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
        <WorkspaceShell>{children}</WorkspaceShell>
      </WorkspaceAccess>
    </Suspense>
  );
}
