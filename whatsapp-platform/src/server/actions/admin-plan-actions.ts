"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePlatformAdminUserId } from "@/server/auth";
import { createPlan, updatePlan, togglePlanActive } from "@/server/billing";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const limitsSchema = z.record(z.string(), z.unknown());

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priceMonthly: z.coerce.number().min(0),
  currency: z.string().trim().length(3),
  limits: z.string(), // JSON text from a textarea
});

function parseLimits(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return limitsSchema.safeParse(parsed).success ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function createPlanAction(input: unknown): Promise<ActionResult> {
  const adminUserId = await requirePlatformAdminUserId();
  if (!adminUserId) return { ok: false, error: "Platform admin access required" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const limits = parseLimits(parsed.data.limits);
  if (limits === null) return { ok: false, error: "Limits must be valid JSON" };

  await createPlan({
    name: parsed.data.name,
    priceMonthly: parsed.data.priceMonthly,
    currency: parsed.data.currency.toUpperCase(),
    limits,
  });

  revalidatePath("/admin/plans");
  return { ok: true };
}

const updateSchema = z.object({
  planId: z.string().uuid(),
  priceMonthly: z.coerce.number().min(0),
  currency: z.string().trim().length(3),
  limits: z.string(),
});

export async function updatePlanAction(input: unknown): Promise<ActionResult> {
  const adminUserId = await requirePlatformAdminUserId();
  if (!adminUserId) return { ok: false, error: "Platform admin access required" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const limits = parseLimits(parsed.data.limits);
  if (limits === null) return { ok: false, error: "Limits must be valid JSON" };

  await updatePlan(parsed.data.planId, {
    priceMonthly: parsed.data.priceMonthly,
    currency: parsed.data.currency.toUpperCase(),
    limits,
  });

  revalidatePath("/admin/plans");
  return { ok: true };
}

const planIdSchema = z.object({ planId: z.string().uuid() });

export async function togglePlanAction(input: unknown): Promise<ActionResult> {
  const adminUserId = await requirePlatformAdminUserId();
  if (!adminUserId) return { ok: false, error: "Platform admin access required" };

  const parsed = planIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await togglePlanActive(parsed.data.planId);
  revalidatePath("/admin/plans");
  return { ok: true };
}
