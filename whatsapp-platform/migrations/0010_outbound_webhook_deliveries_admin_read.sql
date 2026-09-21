-- Same gap as migration 0009, on the other half of the same join: the admin
-- Webhooks health page reads outbound_webhook_deliveries directly (not just
-- joined from it) inside a platform-admin transaction with no app.org_id
-- set. outbound_webhook_deliveries only had the generic tenant_isolation
-- policy, so that SELECT silently returned zero rows under RLS instead of
-- erroring — caught by tests/webhook-health.test.ts still failing after
-- 0009 alone (fixing outbound_webhooks wasn't sufficient; the deliveries
-- table itself needed the same bypass).

DROP POLICY tenant_isolation ON outbound_webhook_deliveries;

CREATE POLICY outbound_webhook_deliveries_select ON outbound_webhook_deliveries
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY outbound_webhook_deliveries_insert ON outbound_webhook_deliveries
  FOR INSERT WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );
