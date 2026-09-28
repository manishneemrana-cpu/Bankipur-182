import type { Metadata, Viewport } from "next";

import "./globals.css";

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
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
