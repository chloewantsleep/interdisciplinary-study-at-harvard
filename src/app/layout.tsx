import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "my.harvard — Cross-Registration Explorer",
  description: "Discover interdisciplinary courses across all Harvard schools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Nav />
        {children}
      </body>
    </html>
  );
}
