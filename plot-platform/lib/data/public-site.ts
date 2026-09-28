import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/db/supabase/server";
import type { Polygon } from "@/lib/geometry/types";

export interface PublicPlot {
  id: string;
  plot_number: string;
  plot_type: string;
  status: string;
  area_official_value: number | null;
  area_official_unit: string | null;
  dimensions: Array<{ side: string; value: number; unit: string }>;
  frontage_ft: number | null;
  depth_ft: number | null;
  facing: string;
  facing_source: string | null;
  corner_status: string;
  road_width_primary_ft: number | null;
  price_total: number | null;
  rate_per_unit: number | null;
  rate_unit: string | null;
  booking_amount: number | null;
  price_visibility: "public" | "on_request";
  geometry: Polygon | null;
  centroid_x: number | null;
  centroid_y: number | null;
  tags: string[];
  public_notes: string | null;
  last_inventory_update: string;
}

export interface PublicRoad {
  id: string;
  name: string | null;
  kind: string;
  width_value: number | null;
  width_unit: string;
  geometry: Polygon;
}

export interface PublicZone {
  id: string;
  kind: string;
  name: string | null;
  geometry: Polygon;
}

export interface PublicLandmark {
  id: string;
  name: string;
  category: string;
  distance_value: number | null;
  distance_unit: string | null;
  travel_time_min: number | null;
  distance_source: string | null;
}

export interface PublicFaq {
  id: string;
  q: string;
  a: string;
  lang: "en" | "hi";
}

export interface PublicDocument {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  verified_at: string | null;
}

export interface PublicSiteData {
  project: {
    id: string;
    name: string;
    slug: string;
    type: string;
    address: string | null;
    city: string | null;
    state: string | null;
    lat: number | null;
    lng: number | null;
    location_verified: boolean;
    total_area_value: number | null;
    total_area_unit: string | null;
    rera_number: string | null;
    rera_authority: string | null;
    rera_url: string | null;
    possession_info: string | null;
    description: string | null;
    visibility: "public" | "password" | "unlisted";
    price_visibility: "public" | "on_request" | "internal";
    is_demo: boolean;
    settings: Record<string, unknown>;
  };
  org: {
    name: string;
    branding: { primaryColor?: string; accentColor?: string; logoUrl?: string };
    contact: { phone?: string; whatsapp?: string; email?: string };
    powered_by_visible: boolean;
  };
  layout: { north_angle_deg: number; unit: string };
  plots: PublicPlot[];
  roads: PublicRoad[];
  zones: PublicZone[];
  landmarks: PublicLandmark[];
  faqs: PublicFaq[];
  documents: PublicDocument[];
}

export type PublicSiteError =
  | "NOT_FOUND"
  | "LINK_DISABLED"
  | "LINK_EXPIRED"
  | "PASSWORD_REQUIRED"
  | "UNAVAILABLE";

export type PublicSiteResult =
  { ok: true; data: PublicSiteData } | { ok: false; error: PublicSiteError };

function passwordCookieName(slug: string): string {
  return `pw_${slug}`;
}

/**
 * Loads a public project's data. Rule 5: any failure other than a known
 * access-control state (not found / disabled / expired / needs password)
 * is reported as "temporarily unavailable" — never a stale render.
 */
export const getPublicSiteData = cache(
  async (slug: string): Promise<PublicSiteResult> => {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const password = cookieStore.get(passwordCookieName(slug))?.value;

    const { data, error } = await supabase.rpc("get_public_site_data", {
      p_slug: slug,
      p_password: password ?? null,
    });

    if (error) {
      const known: PublicSiteError[] = [
        "NOT_FOUND",
        "LINK_DISABLED",
        "LINK_EXPIRED",
        "PASSWORD_REQUIRED",
      ];
      const match = known.find((code) => error.message.includes(code));
      return { ok: false, error: match ?? "UNAVAILABLE" };
    }
    return { ok: true, data: data as PublicSiteData };
  },
);

export { passwordCookieName };
