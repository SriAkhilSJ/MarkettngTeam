import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUTO — Marketing Team | One idea in. Every platform out.",
  description:
    "Give one idea, get a full week of platform-ready social content. Free to start: demo mode needs no API keys.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
