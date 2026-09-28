"use client";

import { track } from "@/lib/analytics/track";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

/** Always-visible, thumb-reachable mobile action bar (§9.2). */
export function StickyActionBar({
  phone,
  whatsapp,
  lang,
  projectSlug,
}: {
  phone?: string;
  whatsapp?: string;
  lang: Lang;
  projectSlug: string;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-background sm:hidden">
      <a
        href={phone ? `tel:${phone}` : "#contact"}
        onClick={() => track(projectSlug, "cta_call")}
        className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs"
      >
        {t(lang, "call")}
      </a>
      <a
        href={
          whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "#contact"
        }
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track(projectSlug, "cta_whatsapp")}
        className="flex flex-col items-center justify-center gap-0.5 border-x border-border py-2.5 text-xs"
      >
        {t(lang, "whatsapp")}
      </a>
      <a
        href="#site-visit"
        onClick={() => track(projectSlug, "cta_visit")}
        className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs"
      >
        {t(lang, "bookSiteVisit")}
      </a>
    </nav>
  );
}
