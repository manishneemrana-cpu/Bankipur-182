"use client";

import { useState, useTransition } from "react";
import { updatePlanAction, togglePlanAction } from "@/server/actions/admin-plan-actions";
import type { Plan } from "@/server/billing";

export function PlanRow({ plan }: { plan: Plan }) {
  const [editing, setEditing] = useState(false);
  const [priceMonthly, setPriceMonthly] = useState(String(plan.priceMonthly));
  const [currency, setCurrency] = useState(plan.currency);
  const [limits, setLimits] = useState(JSON.stringify(plan.limits));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(() => {
      void updatePlanAction({ planId: plan.id, priceMonthly, currency, limits }).then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Failed to save");
          return;
        }
        setError(null);
        setEditing(false);
      });
    });
  }

  function toggle() {
    startTransition(() => {
      void togglePlanAction({ planId: plan.id });
    });
  }

  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-3 font-medium text-ink-900">{plan.name}</td>
      <td className="px-4 py-3">
        {editing ? (
          <input value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} className="input-field w-24" />
        ) : (
          <>
            {plan.priceMonthly} {plan.currency}
          </>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field w-16" maxLength={3} />
        ) : (
          plan.currency
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-500">
        {editing ? (
          <input value={limits} onChange={(e) => setLimits(e.target.value)} className="input-field w-64" />
        ) : (
          JSON.stringify(plan.limits)
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${plan.isActive ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"}`}>
          {plan.isActive ? "active" : "inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={save} disabled={isPending} className="btn-primary px-3 py-1 text-xs">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-3 py-1 text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary px-3 py-1 text-xs">
              Edit
            </button>
            <button onClick={toggle} disabled={isPending} className="btn-secondary px-3 py-1 text-xs">
              {plan.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
