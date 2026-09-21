import { Webhook } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminWebhooksPage() {
  return (
    <AdminStub
      title="Webhooks"
      icon={Webhook}
      description="Webhook delivery health and failure retries ship alongside Meta webhook processing in Phase 4."
    />
  );
}
