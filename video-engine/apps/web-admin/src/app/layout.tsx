import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "ReelEngine — Real-estate video studio",
  description: "Generate luxury real-estate marketing reels from your project details.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
