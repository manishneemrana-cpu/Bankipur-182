"use client";

import { useActionState } from "react";
import { createApiKeyAction, type ActionResult } from "@/server/actions/api-key-actions";

const SCOPES = ["contacts.read", "contacts.write", "leads.read", "leads.write", "whatsapp.messages.send"] as const;

export function CreateApiKeyForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const scopes = SCOPES.filter((s) => formData.get(`scope_${s}`) === "on");
    return createApiKeyAction({ organizationId, name: formData.get("name"), scopes });
  }, null);

  return (
    <div className="card flex flex-col gap-3 p-4">
      {state?.ok && state.rawKey ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Copy this key now — it will not be shown again.</p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs">{state.rawKey}</code>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
            <input name="name" required placeholder="n8n integration" className="input-field" />
          </div>
          <div className="flex flex-wrap gap-3">
            {SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-1.5 text-sm text-ink-600">
                <input type="checkbox" name={`scope_${scope}`} className="rounded" />
                {scope}
              </label>
            ))}
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={isPending} className="btn-primary self-start">
            Create API key
          </button>
        </form>
      )}
    </div>
  );
}
