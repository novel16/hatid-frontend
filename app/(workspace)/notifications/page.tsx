import { NotificationsScreen } from "@/features/settings/workspace-settings";
export const metadata = { title: "Activity & notifications" };
// The workspace verifies rider access before this segment can render.
export const instant = false;
export default function Page() {
  return <NotificationsScreen />;
}
