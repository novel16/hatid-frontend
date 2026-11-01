import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading">
          Getting your rider workspace ready…
        </div>
      }
    >
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
