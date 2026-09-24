import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/worker/models — diagnostic: lists model IDs NVIDIA NIM currently
 * serves for this API key, without ever exposing the key itself. Needed
 * because NVIDIA retires model IDs abruptly (meta/llama-3.1-70b-instruct and
 * its listed successor meta/llama-3.3-70b-instruct both 410'd within the
 * same NIM catalog), so the only reliable way to pick a working default is
 * to ask the API directly. Gated by the same WORKER_TICK_SECRET.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.WORKER_TICK_SECRET;
  if (!expected || req.headers.get("x-worker-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "NVIDIA_API_KEY not set" }, { status: 400 });

  const testModel = req.nextUrl.searchParams.get("test");
  if (testModel) {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: testModel, messages: [{ role: "user", content: "Say OK." }], max_tokens: 5 }),
    });
    const body = await res.text();
    return NextResponse.json({ status: res.status, body });
  }

  const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json();
  return NextResponse.json({ status: res.status, body });
}
