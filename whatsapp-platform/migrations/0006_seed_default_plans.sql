-- Phase 9: seed the plan tiers named in the brief (Starter, Business, AI
-- Business, Enterprise). Prices are placeholders — an admin edits real
-- prices via the admin Plans page; nothing here is meant to be a real
-- price quoted to a customer. `plans` and `pricing_config` intentionally
-- have no RLS (see docs/decisions.md): they're global platform tables, not
-- tenant-scoped, gated by the application's platform-admin check instead.

INSERT INTO plans (name, price_monthly, currency, limits, is_active) VALUES
  ('Starter', 999, 'INR', '{"seats": 2, "connectedNumbers": 1, "contacts": 1000}', true),
  ('Business', 2999, 'INR', '{"seats": 5, "connectedNumbers": 2, "contacts": 10000}', true),
  ('AI Business', 5999, 'INR', '{"seats": 10, "connectedNumbers": 3, "contacts": 50000, "aiEnabled": true}', true),
  ('Enterprise', 0, 'INR', '{"seats": null, "connectedNumbers": null, "contacts": null}', true)
ON CONFLICT (name) DO NOTHING;
