import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Hatid · Rider workspace", template: "%s · Hatid" },
  description:
    "A clearer day for independent riders. Manage parcels, customer stops, collections and seller handovers.",
  applicationName: "Hatid",
  icons: { icon: "/hatid-icon.svg", apple: "/hatid-icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006B54",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-PH"
      data-scroll-behavior="smooth"
      className={manrope.variable}
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
