-- Phase 11: the admin audit-logs page needs to read every organization's
-- audit trail in one place, but audit_logs only had the generic
-- tenant_isolation policy (organization_id = app_org_id()), which has no
-- platform-admin bypass — the same recurring pattern as migrations
-- 0002-0005 and 0007, this time for a read rather than a pre-tenant write.
--
-- Audit logs are also intentionally immutable once written: this replaces
-- tenant_isolation (which allowed UPDATE/DELETE within an org) with SELECT
-- and INSERT policies only. Nothing in the app updates or deletes an audit
-- log row, and nothing should be able to.

DROP POLICY tenant_isolation ON audit_logs;

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );
