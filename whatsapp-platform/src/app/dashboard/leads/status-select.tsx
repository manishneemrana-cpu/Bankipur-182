"use client";

import { useRef } from "react";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "FOLLOW_UP",
  "SITE_VISIT",
  "NEGOTIATION",
  "BOOKED",
  "WON",
  "LOST",
] as const;

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-ink-100 text-ink-700",
  CONTACTED: "bg-amber-100 text-amber-800",
  QUALIFIED: "bg-amber-100 text-amber-800",
  FOLLOW_UP: "bg-amber-100 text-amber-800",
  SITE_VISIT: "bg-blue-100 text-blue-800",
  NEGOTIATION: "bg-blue-100 text-blue-800",
  BOOKED: "bg-brand-100 text-brand-800",
  WON: "bg-brand-100 text-brand-800",
  LOST: "bg-red-100 text-red-700",
};

export function LeadStatusSelect({
  leadId,
  currentStatus,
  action,
}: {
  leadId: string;
  currentStatus: string;
  action: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[currentStatus]}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
