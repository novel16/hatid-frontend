import { EarningsScreen } from "@/features/reports/earnings-screen";
export const metadata = { title: "Earnings & reports" };
// The workspace verifies rider access before this segment can render.
export const instant = false;

/** Render earnings inside the rider workspace. */
export default function Page() {
  return <EarningsScreen />;
}
