import type { Metadata, Viewport } from "next";
import { Manrope, Inter } from "next/font/google";

import "./globals.css";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Deliberately brand-free: each org/project sets its own title, favicon and
// OG image (Product Contract rule 1).
export const metadata: Metadata = {
  title: "Project",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
