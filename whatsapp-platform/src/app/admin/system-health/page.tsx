import { Activity } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminSystemHealthPage() {
  return (
    <AdminStub
      title="System Health"
      icon={Activity}
      description={"Live database/webhook/queue/storage status is available now at /api/health. A friendlier dashboard view ships in a later phase."}
    />
  );
}
