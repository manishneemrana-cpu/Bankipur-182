"use client";

import { useState } from "react";

type Mode = "simple" | "pro_studio";

interface FormState {
  brandKitId: string;
  brandName: string;
  productName: string;
  description: string;
  industry: string;
  keyBenefits: string;
  targetAudience: string;
  ctaText: string;
  language: string;
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
}

const INDUSTRIES = [
  "general", "ecommerce", "real_estate", "saas", "beauty", "fashion",
  "food_beverage", "healthcare", "education", "finance", "hospitality",
  "automotive", "professional_services", "local_business", "startup", "personal_brand",
];

export default function CreationDashboard() {
  const [mode, setMode] = useState<Mode>("simple");
  const [step, setStep] = useState<"input" | "processing" | "complete" | "error">("input");
  const [progressMessage, setProgressMessage] = useState("Initializing");
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState<FormState>({
    brandKitId: "00000000-0000-0000-0000-000000000003",
    brandName: "",
    productName: "",
    description: "",
    industry: "general",
    keyBenefits: "",
    targetAudience: "",
    ctaText: "Shop Now",
    language: "English",
    durationSeconds: 30,
    aspectRatio: "9:16",
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("processing");
    setProgressMessage("Sending brief to the Creative Director pipeline");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": "00000000-0000-0000-0000-000000000001",
          "x-user-id": "00000000-0000-0000-0000-000000000002",
          "x-user-role": "owner",
        },
        body: JSON.stringify({
          ...form,
          keyBenefits: form.keyBenefits.split(",").map((s) => s.trim()).filter(Boolean),
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      setProgressMessage(`Job ${data.jobId} queued — poll /api/jobs/${data.jobId} for live progress`);
      setStep("complete");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/5 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold">U</div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Universal UGC Creative Engine</p>
              <p className="text-xs text-slate-500">Pro Studio Engine — white-label ready</p>
            </div>
          </div>
          <div className="flex rounded-lg border border-white/10 p-1 text-xs">
            <button
              onClick={() => setMode("simple")}
              className={`rounded-md px-3 py-1.5 transition ${mode === "simple" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              Simple
            </button>
            <button
              onClick={() => setMode("pro_studio")}
              className={`rounded-md px-3 py-1.5 transition ${mode === "pro_studio" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              Pro Studio
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-8 py-12">
        {step === "input" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create a world-class video campaign</h1>
              <p className="mt-2 text-sm text-slate-400">
                Give us your product. Our AI creative team plans the strategy, writes the script, storyboards every
                scene, generates video, mixes audio, and quality-checks the result before render.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
              <Field label="Brand Kit ID">
                <input required value={form.brandKitId} onChange={(e) => update("brandKitId", e.target.value)}
                  className="input" placeholder="uuid of an existing brand kit" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Brand Name">
                  <input required value={form.brandName} onChange={(e) => update("brandName", e.target.value)} className="input" />
                </Field>
                <Field label="Product Name">
                  <input required value={form.productName} onChange={(e) => update("productName", e.target.value)} className="input" />
                </Field>
              </div>

              <Field label="Product Description">
                <textarea required rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} className="input" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Industry">
                  <select value={form.industry} onChange={(e) => update("industry", e.target.value)} className="input">
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{i.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Target Audience">
                  <input required value={form.targetAudience} onChange={(e) => update("targetAudience", e.target.value)} className="input" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Key Benefits (comma separated)">
                  <input value={form.keyBenefits} onChange={(e) => update("keyBenefits", e.target.value)} className="input" />
                </Field>
                <Field label="Call to Action">
                  <input value={form.ctaText} onChange={(e) => update("ctaText", e.target.value)} className="input" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Duration (sec)">
                  <select value={form.durationSeconds} onChange={(e) => update("durationSeconds", Number(e.target.value))} className="input">
                    {[6, 8, 10, 15, 20, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d}s</option>)}
                  </select>
                </Field>
                <Field label="Format">
                  <select value={form.aspectRatio} onChange={(e) => update("aspectRatio", e.target.value as FormState["aspectRatio"])} className="input">
                    <option value="9:16">9:16 Vertical</option>
                    <option value="1:1">1:1 Square</option>
                    <option value="16:9">16:9 Landscape</option>
                  </select>
                </Field>
                <Field label="Language">
                  <input value={form.language} onChange={(e) => update("language", e.target.value)} className="input" />
                </Field>
              </div>

              {mode === "pro_studio" && (
                <p className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
                  Pro Studio manual overrides (creator, cinematography, voice, hook) are supported by the API via
                  <code className="mx-1 rounded bg-black/40 px-1">advancedCreative</code>; this scaffold form only exposes
                  Simple Mode fields.
                </p>
              )}

              <button type="submit" className="mt-2 w-full rounded-lg bg-indigo-600 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500">
                CREATE WORLD-CLASS VIDEO
              </button>
            </form>
          </div>
        )}

        {step === "processing" && (
          <div className="mx-auto mt-20 max-w-xl space-y-6 text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
            </div>
            <h2 className="text-xl font-semibold">{progressMessage}</h2>
            <p className="text-sm text-slate-400">
              Brand & audience intelligence, hooks, script, storyboard, scene generation, QC, voice, and render all run
              asynchronously in the background worker.
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="mx-auto mt-20 max-w-xl space-y-4 text-center">
            <h2 className="text-2xl font-bold">Job queued</h2>
            <p className="text-sm text-slate-400">{progressMessage}</p>
            <button onClick={() => setStep("input")} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Create another
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="mx-auto mt-20 max-w-xl space-y-4 text-center">
            <h2 className="text-2xl font-bold text-red-400">Something went wrong</h2>
            <p className="text-sm text-slate-400">{errorMessage}</p>
            <button onClick={() => setStep("input")} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Back
            </button>
          </div>
        )}
      </main>

      <style>{`.input { width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}
