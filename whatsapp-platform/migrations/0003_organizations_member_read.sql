-- Phase 2 fix: getUserOrganizations() joins organization_members to organizations
-- to list "which orgs am I in". organization_members now allows that self-lookup
-- (migration 0002), but the join to `organizations` itself still only allowed
-- id = app_org_id() (unset here) or platform admin — so the JOIN silently
-- dropped every row, and a freshly-registered user's own dashboard redirected
-- them back to /register as if they had no organization. Caught via an actual
-- browser-driven smoke test (register -> GET /dashboard), not by the unit-level
-- RLS tests, which exercised each table in isolation rather than this join.
--
-- Fix: a user may also SELECT an organization they are a member of, per
-- organization_members, regardless of app.org_id. Writes stay exactly as
-- strict as before (id = app_org_id() or platform admin) — a member cannot
-- rename/modify another organization just by virtue of belonging to it.

DROP POLICY org_self_or_admin ON organizations;

CREATE POLICY org_read ON organizations
  FOR SELECT USING (
    id = app_org_id()
    OR app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organizations.id AND m.user_id = app_user_id()
    )
  );

CREATE POLICY org_write ON organizations
  FOR INSERT WITH CHECK (
    id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY org_update ON organizations
  FOR UPDATE USING (
    id = app_org_id() OR app_is_platform_admin()
  ) WITH CHECK (
    id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY org_delete ON organizations
  FOR DELETE USING (
    id = app_org_id() OR app_is_platform_admin()
  );
