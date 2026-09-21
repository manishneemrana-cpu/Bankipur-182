import Link from "next/link";
import { Logo } from "./logo";

export function PublicFooter({ brandName }: { brandName: string }) {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Logo brandName={brandName} />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500">
          <Link href="/privacy" className="hover:text-ink-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink-900">
            Terms
          </Link>
          <Link href="/data-deletion" className="hover:text-ink-900">
            Data deletion
          </Link>
        </nav>
        <p className="text-xs text-ink-400">
          &copy; {new Date().getFullYear()} SitesNSign Prop Tech Pvt. Ltd.
        </p>
      </div>
    </footer>
  );
}
