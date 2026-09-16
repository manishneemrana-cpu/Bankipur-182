"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { DECISION_MAKER_ROLES } from "@/lib/agents/state-machine";
import { assertLiveActionAllowed, ExternalActionBlockedError } from "@/lib/external-actions/guard";
import { getSocialProvider } from "@/lib/social/provider";

export async function publishSocialPost(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string") {
    redirect("/marketing?error=Invalid+request");
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
    .select("role, organization_id, organizations(mode)")
    .eq("id", user.id)
    .single();

  const org = profile?.organizations as unknown as { mode: "demo" | "test" | "live" } | null;

  if (!profile || !DECISION_MAKER_ROLES.includes(profile.role as (typeof DECISION_MAKER_ROLES)[number])) {
    redirect("/marketing?error=Not+authorized+to+publish");
  }

  const { data: post } = await supabase
    .from("social_posts")
    .select("id, organization_id, platform, caption, status")
    .eq("id", postId)
    .single();

  if (!post) {
    redirect("/marketing?error=Post+not+found");
  }

  const socialProvider = getSocialProvider();
  const actionLabel = `Publish ${post.platform} post`;

  try {
    // No approval chain is wired to social_posts in this build (that
    // would require linking each post to an agent_outputs decision) -
    // approved is always false here, which is honest: nothing has
    // actually approved this specific publish action yet.
    assertLiveActionAllowed({
      actionLabel,
      mode: org?.mode ?? null,
      approved: false,
      providerConfigured: socialProvider.isConfigured(post.platform),
    });

    // Unreachable in this build - assertLiveActionAllowed always throws
    // above (mode is never "live", nothing is approved, no provider is
    // configured). Left in place for when a real provider is wired up.
    await socialProvider.publish({ platform: post.platform, caption: post.caption });

    await supabase.from("social_posts").update({ status: "published" }).eq("id", postId);

    await supabase.from("audit_logs").insert({
      organization_id: post.organization_id,
      user_id: user.id,
      department: "marketing",
      action: "social_post.publish",
      environment: org?.mode ?? "demo",
      request: { postId },
      result: { status: "published" },
      status: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase.from("audit_logs").insert({
      organization_id: post.organization_id,
      user_id: user.id,
      department: "marketing",
      action: "social_post.publish_attempt",
      environment: org?.mode ?? "demo",
      request: { postId },
      result: { blocked: true },
      status: err instanceof ExternalActionBlockedError ? "blocked" : "failed",
      error_message: message,
    });

    revalidatePath("/marketing");
    redirect(`/marketing?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/marketing");
}
