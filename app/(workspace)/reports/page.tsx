import { EarningsScreen } from "@/features/reports/earnings-screen";
export const metadata = { title: "Reports" };
// This alias waits for the same workspace access check as Earnings.
export const instant = false;

/** Keep the Reports route on the shared earnings screen. */
export default function Page() {
  return <EarningsScreen />;
}
