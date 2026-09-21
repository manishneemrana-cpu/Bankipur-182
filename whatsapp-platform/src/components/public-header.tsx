import Link from "next/link";
import { Logo } from "./logo";

export function PublicHeader({ brandName }: { brandName: string }) {
  return (
    <header className="border-b border-ink-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo brandName={brandName} />
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-sm font-medium text-ink-600 hover:text-ink-900">
            Log in
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
