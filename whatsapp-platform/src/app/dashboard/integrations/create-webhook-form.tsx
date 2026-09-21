"use client";

import { useActionState } from "react";
import { createOutboundWebhookAction, type ActionResult } from "@/server/actions/webhook-actions";
import { OUTBOUND_EVENT_TYPES } from "@/shared/outbound-webhook-events";

export function CreateWebhookForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const eventTypes = OUTBOUND_EVENT_TYPES.filter((t) => formData.get(`event_${t}`) === "on");
    return createOutboundWebhookAction({ organizationId, url: formData.get("url"), eventTypes });
  }, null);

  return (
    <div className="card flex flex-col gap-3 p-4">
      {state?.ok && state.secret ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Copy this signing secret now — it will not be shown again.</p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs">{state.secret}</code>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Endpoint URL</label>
            <input name="url" type="url" required placeholder="https://your-server.example.com/hooks" className="input-field" />
          </div>
          <div className="flex flex-wrap gap-3">
            {OUTBOUND_EVENT_TYPES.map((eventType) => (
              <label key={eventType} className="flex items-center gap-1.5 text-sm text-ink-600">
                <input type="checkbox" name={`event_${eventType}`} className="rounded" />
                {eventType}
              </label>
            ))}
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={isPending} className="btn-primary self-start">
            Add webhook
          </button>
        </form>
      )}
    </div>
  );
}
