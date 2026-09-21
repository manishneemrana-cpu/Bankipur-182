import { listPlans } from "@/server/billing";
import { CreatePlanForm } from "./create-plan-form";
import { PlanRow } from "./plan-row";

export default async function AdminPlansPage() {
  const plans = await listPlans();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Plans</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Prices and limits here are the only source of truth — nothing in the app hard-codes a
          price. Changing a plan does not retroactively change any organization&apos;s existing
          subscription price.
        </p>
      </div>

      <CreatePlanForm />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Limits</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
