import { ParcelEntryScreen } from "@/features/parcels/parcel-entry-screen";
export const metadata = { title: "Add parcel" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <ParcelEntryScreen />;
}
