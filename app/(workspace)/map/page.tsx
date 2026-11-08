import { MapScreen } from "@/features/map/map-screen";
export const metadata = { title: "Route & map" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <MapScreen />;
}
