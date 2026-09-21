-- The new admin Webhooks health page (/admin/webhooks) joins
-- outbound_webhook_deliveries to outbound_webhooks (to show each delivery's
-- URL) inside a platform-admin transaction, which has no app.org_id set.
-- outbound_webhooks only had the generic tenant_isolation policy
-- (organization_id = app_org_id()), so under RLS that LEFT JOIN silently
-- returned NULL for every row's URL instead of erroring — the same
-- recurring "no platform-admin bypass" pattern as migrations
-- 0002/0003/0004/0005/0007/0008, just manifesting as silently missing data
-- instead of a thrown error this time. Caught by
-- tests/webhook-health.test.ts, not by the page rendering (it rendered
-- fine, just with a blank URL column, which is exactly the "wrong answer
-- with no error" failure mode this pattern is dangerous for).

DROP POLICY tenant_isolation ON outbound_webhooks;

CREATE POLICY outbound_webhooks_select ON outbound_webhooks
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY outbound_webhooks_insert ON outbound_webhooks
  FOR INSERT WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY outbound_webhooks_update ON outbound_webhooks
  FOR UPDATE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  ) WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY outbound_webhooks_delete ON outbound_webhooks
  FOR DELETE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );
