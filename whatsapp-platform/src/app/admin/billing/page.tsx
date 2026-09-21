import { CreditCard } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminBillingPage() {
  return (
    <AdminStub
      title="Billing"
      icon={CreditCard}
      description={
        "Plan and pricing management now live at Admin → Plans. A cross-organization invoice/revenue view (this page) isn't built yet — each organization's own invoices are on its dashboard's Billing page."
      }
    />
  );
}
