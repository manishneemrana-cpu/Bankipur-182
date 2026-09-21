import { FileClock } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminAuditLogsPage() {
  return (
    <AdminStub
      title="Audit Logs"
      icon={FileClock}
      description="The `audit_logs` table exists, but nothing writes to it yet — audit logging ships in Phase 11 alongside security hardening."
    />
  );
}
