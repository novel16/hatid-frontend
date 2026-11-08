import { SellersScreen } from "@/features/people/people-screen";
export const metadata = { title: "Sellers" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <SellersScreen />;
}
