import { SettingsScreen } from "@/features/settings/workspace-settings";
export const metadata = { title: "Settings" };
// This page is intentionally gated by verified client auth; the layout opt-out does not cover child segments.
export const instant = false;
/** Render the existing verified Settings and native app-install controls. */
export default function Page() {
  return <SettingsScreen />;
}
