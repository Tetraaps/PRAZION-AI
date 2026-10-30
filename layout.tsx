import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRAZION AI — Intelligence Beyond Boundaries",
  description: "A unified AI workspace for thinking, learning, creating, and analyzing.",
  applicationName: "PRAZION AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}