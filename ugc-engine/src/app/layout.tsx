import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal AI UGC Creative Engine",
  description: "AI-powered creative production agency for UGC video advertising",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05060a] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
