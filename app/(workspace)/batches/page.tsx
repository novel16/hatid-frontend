import { BatchesScreen } from "@/features/batches/batches-screen";
export const metadata = { title: "Weekly batches" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <BatchesScreen />;
}
