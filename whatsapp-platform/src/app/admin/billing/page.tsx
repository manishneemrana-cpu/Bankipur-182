import { CreditCard } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminBillingPage() {
  return (
    <AdminStub
      title="Billing"
      icon={CreditCard}
      description="Plan/pricing management and Razorpay subscriptions ship in Phase 9."
    />
  );
}
