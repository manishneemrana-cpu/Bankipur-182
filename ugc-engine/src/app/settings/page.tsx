"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CREDENTIAL_CATALOG } from "@/lib/settings/credentialCatalog";

const TENANT_HEADERS = {
  "x-organization-id": "00000000-0000-0000-0000-000000000001",
  "x-user-id": "00000000-0000-0000-0000-000000000002",
  "x-user-role": "owner",
};

interface MaskedValue {
  set: boolean;
  preview?: string;
}

export default function SettingsPage() {
  const [existing, setExisting] = useState<Record<string, MaskedValue>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/credentials", { headers: TENANT_HEADERS });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setExisting(data.values);
        // Non-secret fields (text/select) prefill directly from the stored plain value.
        const prefill: Record<string, string> = {};
        for (const group of CREDENTIAL_CATALOG) {
          for (const field of group.fields) {
            if (field.type !== "secret" && data.values[field.key]?.set) {
              prefill[field.key] = data.values[field.key].preview ?? "";
            }
          }
        }
        setDrafts(prefill);
        setStatus("ready");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }
    load();
  }, []);

  const update = (key: string, value: string) => {
    setDrafts((d) => ({ ...d, [key]: value }));
    setTouched((t) => new Set(t).add(key));
  };

  const handleSave = async () => {
    setStatus("saving");
    try {
      const values: Record<string, string> = {};
      for (const key of touched) values[key] = drafts[key] ?? "";

      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...TENANT_HEADERS },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      const refreshed = await fetch("/api/settings/credentials", { headers: TENANT_HEADERS }).then((r) => r.json());
      setExisting(refreshed.values);
      setTouched(new Set());
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-12 text-slate-100">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys & Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Paste your own provider keys here — they're stored encrypted per-organization and used automatically
            instead of the platform's defaults.
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back
        </Link>
      </div>

      {status === "loading" && <p className="text-sm text-slate-500">Loading…</p>}

      {status !== "loading" && (
        <div className="space-y-8">
          {CREDENTIAL_CATALOG.map((group) => (
            <section key={group.group} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{group.group}</h2>
              {group.description && <p className="mt-1 text-xs text-slate-500">{group.description}</p>}

              <div className="mt-4 space-y-4">
                {group.fields.map((field) => {
                  const meta = existing[field.key];
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-medium text-slate-300">{field.label}</label>

                      {field.type === "select" ? (
                        <select
                          value={drafts[field.key] ?? ""}
                          onChange={(e) => update(field.key, e.target.value)}
                          className="settings-input"
                        >
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "— auto —"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "secret" ? "password" : "text"}
                          value={drafts[field.key] ?? ""}
                          onChange={(e) => update(field.key, e.target.value)}
                          placeholder={
                            field.type === "secret" && meta?.set ? `Set — ${meta.preview} (type to replace)` : field.placeholder
                          }
                          className="settings-input"
                        />
                      )}

                      <p className="mt-1 text-xs text-slate-500">{field.whereToGet}</p>
                      {meta?.set && field.type === "secret" && (
                        <p className="mt-0.5 text-xs text-emerald-400">Currently set ({meta.preview})</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="sticky bottom-6 flex items-center justify-between rounded-xl border border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
            <p className="text-xs text-slate-400">
              {touched.size > 0 ? `${touched.size} field(s) changed` : "No changes yet"}
            </p>
            <button
              onClick={handleSave}
              disabled={touched.size === 0 || status === "saving"}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save changes"}
            </button>
          </div>

          {status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}
        </div>
      )}

      <style>{`.settings-input { width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
    </div>
  );
}
