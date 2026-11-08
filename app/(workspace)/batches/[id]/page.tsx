import { Suspense } from "react";
import { BatchesScreen } from "@/features/batches/batches-screen";
export const metadata = { title: "Batch details" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
type Props = { params: Promise<{ id: string }> };
async function Batch({ params }: Props) {
  const { id } = await params;
  return <BatchesScreen key={id} batchId={id} />;
}
export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={<div className="workspace-loading">Opening weekly batch…</div>}
    >
      <Batch params={params} />
    </Suspense>
  );
}
