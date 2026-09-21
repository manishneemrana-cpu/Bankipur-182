"use client";

import { useActionState } from "react";
import { createPlanAction, type ActionResult } from "@/server/actions/admin-plan-actions";

export function CreatePlanForm() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    return createPlanAction({
      name: formData.get("name"),
      priceMonthly: formData.get("priceMonthly"),
      currency: formData.get("currency"),
      limits: formData.get("limits"),
    });
  }, null);

  return (
    <form action={formAction} className="card flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
          <input name="name" required className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Price / month</label>
          <input name="priceMonthly" type="number" min="0" step="1" required className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Currency</label>
          <input name="currency" defaultValue="INR" maxLength={3} required className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Limits (JSON)</label>
          <input name="limits" defaultValue='{"seats": 2}' required className="input-field" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary self-start">
        Add plan
      </button>
    </form>
  );
}
