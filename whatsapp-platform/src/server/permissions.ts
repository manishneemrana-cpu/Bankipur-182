export type OrgRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";

export type Permission =
  | "manage_whatsapp"
  | "send_messages"
  | "manage_templates"
  | "manage_campaigns"
  | "manage_contacts"
  | "manage_users"
  | "manage_billing"
  | "view_analytics"
  | "manage_automations";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: [
    "manage_whatsapp",
    "send_messages",
    "manage_templates",
    "manage_campaigns",
    "manage_contacts",
    "manage_users",
    "manage_billing",
    "view_analytics",
    "manage_automations",
  ],
  ADMIN: [
    "manage_whatsapp",
    "send_messages",
    "manage_templates",
    "manage_campaigns",
    "manage_contacts",
    "manage_users",
    "view_analytics",
    "manage_automations",
  ],
  MANAGER: [
    "send_messages",
    "manage_templates",
    "manage_campaigns",
    "manage_contacts",
    "view_analytics",
    "manage_automations",
  ],
  AGENT: ["send_messages", "manage_contacts"],
  VIEWER: ["view_analytics"],
};

/** permissions: granular overrides stored on organization_members, additive to the role's defaults. */
export function hasPermission(
  role: OrgRole,
  overrides: readonly string[],
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission) || overrides.includes(permission);
}
