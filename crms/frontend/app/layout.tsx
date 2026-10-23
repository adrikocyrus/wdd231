import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Benchflow — Repair operations",
  description: "Computer repair shop ticket and inventory management"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
