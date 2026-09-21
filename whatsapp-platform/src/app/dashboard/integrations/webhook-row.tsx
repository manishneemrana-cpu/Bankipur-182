"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleOutboundWebhookAction, deleteOutboundWebhookAction } from "@/server/actions/webhook-actions";
import type { OutboundWebhook } from "@/server/outbound-webhooks";

export function WebhookRow({ organizationId, webhook }: { organizationId: string; webhook: OutboundWebhook }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-3 font-mono text-xs text-ink-700">{webhook.url}</td>
      <td className="px-4 py-3 text-xs text-ink-500">{webhook.eventTypes.join(", ")}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${webhook.enabled ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"}`}>
          {webhook.enabled ? "enabled" : "disabled"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                void toggleOutboundWebhookAction({ organizationId, webhookId: webhook.id }).then(() => router.refresh());
              })
            }
            className="btn-secondary px-3 py-1 text-xs"
          >
            {webhook.enabled ? "Disable" : "Enable"}
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                void deleteOutboundWebhookAction({ organizationId, webhookId: webhook.id }).then(() => router.refresh());
              })
            }
            className="btn-secondary px-3 py-1 text-xs"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
