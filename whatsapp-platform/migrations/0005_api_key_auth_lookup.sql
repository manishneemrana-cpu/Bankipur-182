-- Phase 8: API key authentication resolves the organization from a bare raw
-- key (hashed) before any organization_id is known — the same pre-tenant
-- lookup pattern as organization signup, webhook processing, and phone
-- number resolution before it (migrations 0002-0004). api_keys only had the
-- generic tenant_isolation policy, so a plain withSystemClient lookup (no
-- app.org_id, no app.is_platform_admin) would see nothing. Fixed the same
-- way as whatsapp_phone_numbers: a platform-admin bypass on SELECT and
-- UPDATE (needed for last_used_at), while INSERT/DELETE stay strictly
-- org-scoped since key creation and revocation always happen from within an
-- authenticated dashboard session that already has an organization_id.

DROP POLICY tenant_isolation ON api_keys;

CREATE POLICY api_keys_select ON api_keys
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT WITH CHECK (
    organization_id = app_org_id()
  );

CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  ) WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE USING (
    organization_id = app_org_id()
  );
