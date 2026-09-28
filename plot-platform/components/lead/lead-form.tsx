"use client";

import { useActionState } from "react";

import {
  submitLead,
  type LeadState,
} from "@/app/(public)/p/[projectSlug]/actions";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

const initialState: LeadState = {};

/** Enquiry / site-visit form (§13). Used standalone and pre-filled from a plot. */
export function LeadForm({
  slug,
  password,
  lang,
  source = "form",
  plotNumber,
  ref: shareRef,
  withVisitFields = false,
}: {
  slug: string;
  password?: string;
  lang: Lang;
  source?: "form" | "site_visit";
  plotNumber?: string;
  ref?: string;
  withVisitFields?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    submitLead.bind(null, slug, password),
    initialState,
  );

  if (state.success) {
    return (
      <p className="text-success-foreground text-sm font-medium">
        {t(lang, "thankYou")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="source" value={source} />
      {shareRef ? <input type="hidden" name="ref" value={shareRef} /> : null}
      {plotNumber ? (
        <input type="hidden" name="plot_numbers" value={plotNumber} />
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        {t(lang, "name")}
        <input
          name="name"
          required
          className="h-10 rounded-md border border-input px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t(lang, "phone")}
        <input
          name="phone"
          required
          type="tel"
          placeholder="98765 43210"
          className="h-10 rounded-md border border-input px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t(lang, "email")}
        <input
          name="email"
          type="email"
          className="h-10 rounded-md border border-input px-3"
        />
      </label>
      {withVisitFields ? (
        <label className="flex flex-col gap-1 text-sm">
          {t(lang, "preferredDate")}
          <input
            name="visit_date"
            type="date"
            className="h-10 rounded-md border border-input px-3"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          {t(lang, "message")}
          <textarea
            name="message"
            rows={2}
            className="rounded-md border border-input px-3 py-2"
          />
        </label>
      )}

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        {t(lang, "consent")}
      </label>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "…" : t(lang, "submit")}
      </button>
    </form>
  );
}
