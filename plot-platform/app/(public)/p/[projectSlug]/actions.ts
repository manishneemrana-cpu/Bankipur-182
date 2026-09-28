"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { passwordCookieName } from "@/lib/data/public-site";

export interface PasswordState {
  error?: string;
}

export async function submitPassword(
  slug: string,
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data: ok, error } = await supabase.rpc("verify_project_password", {
    p_slug: slug,
    p_password: password,
  });
  if (error || !ok) return { error: "Incorrect password." };

  const cookieStore = await cookies();
  cookieStore.set(passwordCookieName(slug), password, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/p/${slug}`,
    maxAge: 60 * 60 * 24, // 24h — matches the default hold/session feel elsewhere
  });
  redirect(`/p/${slug}`);
}

export interface LeadState {
  error?: string;
  success?: boolean;
}

export async function submitLead(
  slug: string,
  password: string | undefined,
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone.startsWith("+")
    ? rawPhone
    : `+91${rawPhone.replace(/\D/g, "")}`;
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const consent = formData.get("consent") === "on";
  const source = String(formData.get("source") ?? "form");
  const ref = formData.get("ref") ? String(formData.get("ref")) : null;
  const plotNumbers = formData.getAll("plot_numbers").map(String);
  const visitDate = formData.get("visit_date")
    ? String(formData.get("visit_date"))
    : null;
  const visitSlot = formData.get("visit_slot")
    ? String(formData.get("visit_slot"))
    : null;
  const visitors = formData.get("visitors")
    ? Number(formData.get("visitors"))
    : null;

  if (!name || !rawPhone) return { error: "Name and phone are required." };
  if (!consent) return { error: "Please agree to be contacted to continue." };
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone))
    return { error: "Enter a valid phone number." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_public_lead", {
    p_slug: slug,
    p_password: password ?? null,
    p_name: name,
    p_phone: phone,
    p_email: email || null,
    p_message: message || null,
    p_plot_numbers: plotNumbers,
    p_source: source,
    p_ref: ref,
    p_consent: consent,
    p_visit_date: visitDate,
    p_visit_slot: visitSlot,
    p_visitors: visitors,
  });
  if (error)
    return {
      error: "Something went wrong — please try again or call us directly.",
    };

  return { success: true };
}
