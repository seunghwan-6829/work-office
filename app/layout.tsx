import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Premiere Asset Orchestrator",
  description: "SRT-driven asset planning and XML export for Premiere workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
