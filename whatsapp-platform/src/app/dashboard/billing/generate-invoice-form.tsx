"use client";

import { useActionState } from "react";
import { generateInvoiceAction, type ActionResult } from "@/server/actions/billing-actions";

function isoMonthAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function GenerateInvoiceForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    return generateInvoiceAction({
      organizationId,
      periodStart: formData.get("periodStart"),
      periodEnd: formData.get("periodEnd"),
    });
  }, null);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-600">Period start</label>
        <input name="periodStart" type="date" defaultValue={isoMonthAgo(1)} required className="input-field" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-600">Period end</label>
        <input name="periodEnd" type="date" defaultValue={isoMonthAgo(0)} required className="input-field" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        Generate invoice
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
