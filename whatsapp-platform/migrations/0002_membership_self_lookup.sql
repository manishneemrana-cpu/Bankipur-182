-- Phase 2 fix: a signed-in user looking up "which organizations am I in?" (needed
-- for login and the org switcher) has no organization_id yet — that's exactly
-- what this query is for. The Phase 1 policy on organization_members only
-- matched by organization_id (or platform admin), so that lookup returned zero
-- rows under real RLS enforcement. Never caught in Phase 1 because
-- requireOrgContext() was written but not yet exercised by a real login flow.

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

DROP POLICY org_members_self_or_admin ON organization_members;

-- Reads: a user can see their own membership rows (any organization, so they
-- can discover/switch between organizations they belong to), OR every member
-- row within an organization they're currently scoped into (needed for a
-- Team page), OR everything as a platform admin.
-- Writes: deliberately narrower — user_id = app_user_id() is NOT enough to
-- insert/update a membership row, or any signed-in user could grant
-- themselves OWNER on an arbitrary organization. Only a request already
-- scoped to that organization (e.g. an existing OWNER/ADMIN inviting someone)
-- or a platform admin (e.g. the signup flow creating the first membership)
-- may write.
CREATE POLICY org_members_self_or_admin ON organization_members
  FOR SELECT USING (
    organization_id = app_org_id()
    OR user_id = app_user_id()
    OR app_is_platform_admin()
  );

CREATE POLICY org_members_write ON organization_members
  FOR INSERT WITH CHECK (
    organization_id = app_org_id()
    OR app_is_platform_admin()
  );

CREATE POLICY org_members_update ON organization_members
  FOR UPDATE USING (
    organization_id = app_org_id()
    OR app_is_platform_admin()
  ) WITH CHECK (
    organization_id = app_org_id()
    OR app_is_platform_admin()
  );

CREATE POLICY org_members_delete ON organization_members
  FOR DELETE USING (
    organization_id = app_org_id()
    OR app_is_platform_admin()
  );
