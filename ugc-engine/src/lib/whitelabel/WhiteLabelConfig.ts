export interface WhiteLabelConfig {
  platformName: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  domain: string | null;
}

export interface OrganizationWhiteLabelRow {
  is_white_label: boolean;
  white_label_domain: string | null;
  white_label_name: string | null;
  white_label_logo_url: string | null;
  white_label_primary_color: string | null;
  white_label_support_email: string | null;
}

const DEFAULT_CONFIG: WhiteLabelConfig = {
  platformName: process.env.DEFAULT_PLATFORM_NAME || "Universal AI UGC Creative Engine",
  logoUrl: null,
  primaryColor: "#6366F1",
  supportEmail: null,
  domain: null,
};

/**
 * Resolves branding for a request. Every org gets the default platform
 * identity unless it has opted into white-labeling (spec section 57) — no
 * per-tenant fork of the codebase, one config resolver per request.
 */
export function resolveWhiteLabelConfig(org?: OrganizationWhiteLabelRow | null): WhiteLabelConfig {
  if (!org || !org.is_white_label) return DEFAULT_CONFIG;

  return {
    platformName: org.white_label_name || DEFAULT_CONFIG.platformName,
    logoUrl: org.white_label_logo_url,
    primaryColor: org.white_label_primary_color || DEFAULT_CONFIG.primaryColor,
    supportEmail: org.white_label_support_email,
    domain: org.white_label_domain,
  };
}
