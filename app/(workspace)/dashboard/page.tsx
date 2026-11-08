import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
export const metadata = { title: "Overview" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <DashboardScreen />;
}
