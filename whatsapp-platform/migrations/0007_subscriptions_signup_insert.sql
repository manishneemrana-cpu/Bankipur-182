-- Phase 9: organization signup now also creates the founding subscription
-- (Starter plan), in the same platform-admin transaction as the org and its
-- OWNER membership (see registerOrganization in auth-actions.ts) - the same
-- "no organization_id exists yet" situation as every other pre-tenant
-- insert (migrations 0002-0005). subscriptions only had the generic
-- tenant_isolation policy, so this insert would fail the same way those did.

DROP POLICY tenant_isolation ON subscriptions;

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY subscriptions_insert ON subscriptions
  FOR INSERT WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY subscriptions_update ON subscriptions
  FOR UPDATE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  ) WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY subscriptions_delete ON subscriptions
  FOR DELETE USING (
    organization_id = app_org_id()
  );
