"use client";

import { useState, useTransition } from "react";
import { requestOrganizationDeletionAction } from "@/server/actions/data-lifecycle-actions";

export function DangerZone({ organizationId, alreadyRequested }: { organizationId: string; alreadyRequested: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [requested, setRequested] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requested) {
    return (
      <p className="text-sm text-ink-500">
        A deletion request for this organization is pending platform admin review.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-secondary border-red-300 text-red-700 hover:bg-red-50">
        Request organization deletion
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-red-700">
        This flags the entire organization — every contact, conversation, message, and template —
        for deletion. It does not happen instantly: a platform admin reviews and actions the
        request. This cannot be undone once actioned.
      </p>
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void requestOrganizationDeletionAction({ organizationId }).then((result) => {
                if (!result.ok) {
                  setError(result.error ?? "Failed to submit request");
                  return;
                }
                setRequested(true);
              });
            })
          }
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Confirm deletion request
        </button>
        <button onClick={() => setConfirming(false)} className="btn-secondary px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
