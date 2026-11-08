import { CustomersScreen } from "@/features/people/people-screen";
export const metadata = { title: "Customers" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <CustomersScreen />;
}
