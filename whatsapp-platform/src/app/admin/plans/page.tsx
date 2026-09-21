import { Layers } from "lucide-react";
import { AdminStub } from "../admin-stub";

export default function AdminPlansPage() {
  return (
    <AdminStub
      title="Plans"
      icon={Layers}
      description="Editable Starter/Business/AI Business/Enterprise plans ship in Phase 9. The `plans` table already exists in the database."
    />
  );
}
