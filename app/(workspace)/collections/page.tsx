import { CollectionsScreen } from "@/features/collections/collections-screen";
export const metadata = { title: "Collections & remittances" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <CollectionsScreen />;
}
