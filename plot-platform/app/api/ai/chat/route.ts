import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAnthropicProvider } from "@/lib/ai/anthropic-provider";
import { isRateLimited } from "@/lib/ai/rate-limit";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { buildTools, type SubmitLeadFn } from "@/lib/ai/tools";
import type { ChatProvider } from "@/lib/ai/provider";
import { createClient } from "@/lib/db/supabase/server";
import { getPublicSiteData, passwordCookieName } from "@/lib/data/public-site";
import { serverEnv } from "@/lib/env/server";

const bodySchema = z.object({
  projectSlug: z.string().min(1),
  sessionId: z.string().min(1),
  lang: z.enum(["en", "hi"]).default("en"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(40),
});

const NOT_CONFIGURED_TEXT =
  "The AI assistant is not configured for this project yet. Please use the search box above, or contact the sales team directly.";
const UNANSWERED_PHRASE = "I don't have that information";
const USAGE_LIMIT_TEXT =
  "This project's AI assistant has reached its monthly usage limit. Please use the search box above, or contact the sales team directly.";

function providerFor(): ChatProvider | null {
  const env = serverEnv();
  if (!env.AI_API_KEY) return null;
  // AI_PROVIDER defaults to Anthropic; other adapters (OpenAI/Gemini) can be
  // added here behind the same ChatProvider interface (§12.1) once needed.
  if (!env.AI_PROVIDER || env.AI_PROVIDER === "anthropic") {
    return createAnthropicProvider(
      env.AI_API_KEY,
      env.AI_MODEL ?? "claude-haiku-4-5-20251001",
    );
  }
  return null;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { projectSlug, sessionId, lang, messages } = parsed.data;

  if (isRateLimited(`${ip}:${projectSlug}`)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const result = await getPublicSiteData(projectSlug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  const data = result.data;

  const provider = providerFor();
  if (!provider) {
    return NextResponse.json({ text: NOT_CONFIGURED_TEXT, toolCalls: [] });
  }

  const supabase = await createClient();
  const cookieStore = await cookies();
  const password = cookieStore.get(passwordCookieName(projectSlug))?.value;

  // Reserve a turn against this org's plan before ever calling the model —
  // never bill/log a call that wasn't actually made (§9 usage metering).
  const { data: reserved } = await supabase.rpc("reserve_ai_turn", {
    p_slug: projectSlug,
    p_password: password ?? null,
  });
  if (reserved === false) {
    return NextResponse.json({ text: USAGE_LIMIT_TEXT, toolCalls: [] });
  }

  const submitLead: SubmitLeadFn = async (args) => {
    const { error } = await supabase.rpc("submit_public_lead", {
      p_slug: projectSlug,
      p_password: password ?? null,
      p_name: args.name,
      p_phone: args.phone,
      p_email: null,
      p_message: args.message,
      p_plot_numbers: args.plotNumbers,
      p_source: args.source,
      p_ref: null,
      p_consent: true,
      p_visit_date: args.visitDate ?? null,
      p_visit_slot: args.visitSlot ?? null,
      p_visitors: args.visitors ?? null,
    });
    if (error) return { ok: false, error: "SUBMIT_FAILED" };
    return { ok: true };
  };

  const { specs, execute } = buildTools(data, submitLead);
  const system = buildSystemPrompt({
    name: data.project.name,
    city: data.project.city,
    state: data.project.state,
  });

  try {
    const turn = await provider.chat({
      system,
      messages,
      tools: specs,
      executeTool: execute,
    });
    const lastUserMessage = messages[messages.length - 1]?.content ?? "";
    await supabase.rpc("log_ai_turn", {
      p_slug: projectSlug,
      p_password: password ?? null,
      p_session_id: sessionId,
      p_lang: lang,
      p_user_message: lastUserMessage,
      p_assistant_message: turn.text,
      p_tool_calls: turn.toolCalls,
      p_unanswered: turn.text.includes(UNANSWERED_PHRASE),
    });
    return NextResponse.json(turn);
  } catch {
    return NextResponse.json(
      {
        text: "The AI assistant is temporarily unavailable — please try again, or contact the sales team.",
        toolCalls: [],
      },
      { status: 200 },
    );
  }
}
