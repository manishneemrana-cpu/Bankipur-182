-- Phase 4 fix: webhook processing resolves which organization owns an
-- incoming phone_number_id before any organization_id is known — the same
-- "no tenant context yet" situation signup and the org-membership lookup
-- already needed special policies for (migrations 0002, 0003). But
-- whatsapp_phone_numbers only ever got the generic tenant_isolation policy
-- (organization_id = app_org_id()), with no platform-admin bypass, so
-- withPlatformAdminTransaction's app.is_platform_admin flag was simply never
-- checked — the lookup silently returned zero rows. Caught by
-- tests/webhook-processing.test.ts, not assumed fixed by analogy.
--
-- whatsapp_phone_numbers holds operational metadata (display number, quality
-- rating, connection status) — not customer message content — so a
-- platform-admin bypass here doesn't touch the privacy rule that keeps
-- admins away from conversations/messages/contacts.

DROP POLICY tenant_isolation ON whatsapp_phone_numbers;

CREATE POLICY whatsapp_phone_numbers_select ON whatsapp_phone_numbers
  FOR SELECT USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY whatsapp_phone_numbers_write ON whatsapp_phone_numbers
  FOR INSERT WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY whatsapp_phone_numbers_update ON whatsapp_phone_numbers
  FOR UPDATE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  ) WITH CHECK (
    organization_id = app_org_id() OR app_is_platform_admin()
  );

CREATE POLICY whatsapp_phone_numbers_delete ON whatsapp_phone_numbers
  FOR DELETE USING (
    organization_id = app_org_id() OR app_is_platform_admin()
  );
