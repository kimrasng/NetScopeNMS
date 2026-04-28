import "@cloudscape-design/global-styles/index.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NetPulse",
  description: "AI-Powered Network Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
