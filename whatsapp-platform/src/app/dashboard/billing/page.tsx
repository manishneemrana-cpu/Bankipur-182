import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { hasPermission } from "@/server/permissions";
import { getCurrentSubscription, listInvoicesForOrganization } from "@/server/billing";
import { GenerateInvoiceForm } from "./generate-invoice-form";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-brand-100 text-brand-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-ink-100 text-ink-600",
  SUSPENDED: "bg-red-100 text-red-700",
  ISSUED: "bg-amber-100 text-amber-800",
  PAID: "bg-brand-100 text-brand-800",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-ink-100 text-ink-600",
  DRAFT: "bg-ink-100 text-ink-600",
};

export default async function BillingPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const [subscription, invoices] = await Promise.all([
    getCurrentSubscription(currentOrg.organizationId),
    listInvoicesForOrganization(currentOrg.organizationId),
  ]);
  const canManage = hasPermission(currentOrg.role, [], "manage_billing");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Billing</h1>
        <p className="mt-1 text-sm text-ink-500">Your plan, invoices, and usage-based charges.</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900">Current plan</h2>
        {subscription ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-ink-900">{subscription.planName}</span>
            <span className="text-sm text-ink-500">
              {subscription.priceMonthly} {subscription.currency} / month
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[subscription.status] ?? "bg-ink-100 text-ink-600"}`}>
              {subscription.status}
            </span>
            {subscription.currentPeriodEnd && (
              <span className="text-xs text-ink-400">
                renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">No subscription found.</p>
        )}
      </div>

      {canManage && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink-900">Generate invoice</h2>
          <GenerateInvoiceForm organizationId={currentOrg.organizationId} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-500">No invoices yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Line items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-ink-100 align-top">
                    <td className="px-4 py-3 text-ink-500">
                      {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5 text-xs text-ink-500">
                        {invoice.lineItems.map((item, i) => (
                          <li key={i}>
                            {item.description} — {item.amount} {invoice.currency}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {invoice.totalAmount} {invoice.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status] ?? "bg-ink-100 text-ink-600"}`}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
