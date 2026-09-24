"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSitesNSignConnector } from "@/lib/sitesnsign";

/**
 * Records OWNER/ADMIN intent to activate a given integration for LIVE
 * use. Per the master spec, LIVE mode activation is OWNER/ADMIN only -
 * stricter than the approvals engine's OWNER/ADMIN/EXECUTIVE. This never
 * flips status to healthy/connected on its own: that still requires real,
 * verified credentials for the integration in question. What this
 * records is governance intent + an audit trail, not connectivity.
 */
export async function activateIntegration(formData: FormData) {
  const healthId = formData.get("healthId");
  if (typeof healthId !== "string") {
    redirect("/system-health?error=Invalid+request");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["OWNER", "ADMIN"].includes(profile.role)) {
    redirect("/system-health?error=Only+OWNER%2FADMIN+can+activate+an+integration");
  }

  const { data: health } = await supabase
    .from("system_health")
    .select("id, organization_id, service, status")
    .eq("id", healthId)
    .single();

  if (!health) {
    redirect("/system-health?error=Integration+not+found");
  }

  const { error } = await supabase
    .from("system_health")
    .update({ activated_by: user.id, activated_at: new Date().toISOString() })
    .eq("id", healthId);

  if (error) {
    redirect(`/system-health?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("audit_logs").insert({
    organization_id: health.organization_id,
    user_id: user.id,
    department: null,
    action: "integration.activation_requested",
    environment: "live",
    request: { service: health.service },
    result: {
      note: "Activation intent recorded. Status stays " + health.status + " until real credentials are configured and verified.",
    },
    status: "success",
  });

  revalidatePath("/system-health");
}

/**
 * Real connectivity check for the SitesNSign connector. Calls the actual
 * live connector's ping() when SITESNSIGN_API_URL/API_KEY are configured;
 * otherwise reports not_connected honestly. This is the only method the
 * live connector currently has full confidence in (verified directly
 * against the real Swagger doc) - see live-connector.ts for what's still
 * inferred and unverified.
 */
export async function checkSitesNSignConnection(formData: FormData) {
  const healthId = formData.get("healthId");
  if (typeof healthId !== "string") {
    redirect("/system-health?error=Invalid+request");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["OWNER", "ADMIN"].includes(profile.role)) {
    redirect("/system-health?error=Only+OWNER%2FADMIN+can+check+a+connection");
  }

  const { data: health } = await supabase
    .from("system_health")
    .select("id, organization_id, service")
    .eq("id", healthId)
    .single();

  if (!health) {
    redirect("/system-health?error=Integration+not+found");
  }

  let status: "healthy" | "not_connected" | "error" = "not_connected";
  let detail: string;

  if (!process.env.SITESNSIGN_API_URL || !process.env.SITESNSIGN_API_KEY) {
    detail = "SITESNSIGN_API_URL / SITESNSIGN_API_KEY not configured.";
  } else {
    const connector = getSitesNSignConnector();
    try {
      if ("ping" in connector && typeof connector.ping === "function") {
        await (connector as { ping: () => Promise<{ ok: true }> }).ping();
        status = "healthy";
        detail = `Ping succeeded at ${new Date().toISOString()}.`;
      } else {
        detail = "Connected connector has no ping() method.";
      }
    } catch (err) {
      status = "error";
      detail = err instanceof Error ? err.message : "Unknown error";
    }
  }

  await supabase
    .from("system_health")
    .update({ status, detail, last_checked_at: new Date().toISOString() })
    .eq("id", healthId);

  await supabase.from("audit_logs").insert({
    organization_id: health.organization_id,
    user_id: user.id,
    department: null,
    action: "integration.connection_check",
    environment: "live",
    request: { service: health.service },
    result: { status, detail },
    status: status === "error" ? "failed" : "success",
  });

  revalidatePath("/system-health");
}
