-- Phase 1: core schema for the white-label WhatsApp Business Platform.
-- Tenant term used everywhere: organization_id (see docs/decisions.md).
-- Every tenant-scoped table carries organization_id + Row-Level Security.
-- The app resolves organization_id server-side from the session and sets it
-- per-request with `SET LOCAL app.org_id = '<uuid>'` inside a transaction —
-- RLS policies read that setting; a browser-supplied id is never trusted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Once a custom GUC like app.org_id has been SET LOCAL on a backend, Postgres
-- reverts it to '' (empty string) rather than NULL once the transaction ends
-- — not NULL, because the placeholder now exists. Since connection pools
-- reuse backends across requests, a request that forgets to set app.org_id
-- would otherwise hit a cast error (or worse, silently read a stale value)
-- rather than cleanly seeing "no organization". These helpers normalize that.
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS boolean AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_platform_admin', true), ''), 'false')::boolean;
$$ LANGUAGE sql STABLE;

-- =========================================================================
-- Organizations (tenants) and membership
-- =========================================================================

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_name text,
  logo_url text,
  primary_color text,
  custom_domain text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  parent_organization_id uuid REFERENCES organizations(id),
  plan_id uuid,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency text NOT NULL DEFAULT 'INR',
  retention_days integer NOT NULL DEFAULT 365,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE org_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER');

CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'AGENT',
  permissions text[] NOT NULL DEFAULT '{}', -- granular overrides on top of role
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- =========================================================================
-- WhatsApp / Meta integration
-- =========================================================================

CREATE TABLE whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  business_portfolio_id text,
  name text,
  currency text,
  timezone text,
  onboarding_type text NOT NULL CHECK (onboarding_type IN ('COEXISTENCE', 'NEW', 'MIGRATED')),
  connection_status text NOT NULL DEFAULT 'PENDING',
  business_verification_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, waba_id)
);
CREATE INDEX idx_whatsapp_accounts_org ON whatsapp_accounts(organization_id);
CREATE TRIGGER trg_whatsapp_accounts_updated_at BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE whatsapp_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  quality_rating text,
  messaging_limit_tier text,
  status text NOT NULL DEFAULT 'PENDING',
  is_coexistence boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_number_id)
);
CREATE INDEX idx_whatsapp_phone_numbers_org ON whatsapp_phone_numbers(organization_id);
CREATE INDEX idx_whatsapp_phone_numbers_pnid ON whatsapp_phone_numbers(phone_number_id);
CREATE TRIGGER trg_whatsapp_phone_numbers_updated_at BEFORE UPDATE ON whatsapp_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Encrypted at rest by the app (AES-256-GCM) before insert; never selected into any client-facing API.
CREATE TABLE whatsapp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  encrypted_token text NOT NULL,
  key_version integer NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_credentials_org ON whatsapp_credentials(organization_id);
CREATE TRIGGER trg_whatsapp_credentials_updated_at BEFORE UPDATE ON whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'STARTED' CHECK (state IN (
    'STARTED', 'META_AUTHENTICATING', 'BUSINESS_SELECTED', 'WABA_SELECTED',
    'PHONE_SELECTED', 'CONNECTING', 'VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED'
  )),
  csrf_state text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  connection_path text CHECK (connection_path IN ('EXISTING_APP_NUMBER', 'NEW_NUMBER', 'MIGRATED')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_sessions_org ON onboarding_sessions(organization_id);
CREATE TRIGGER trg_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- Contacts, conversations, messages
-- =========================================================================

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  name text,
  tags text[] NOT NULL DEFAULT '{}',
  custom_fields jsonb NOT NULL DEFAULT '{}',
  source text,
  opt_in_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (opt_in_status IN ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN')),
  opt_in_at timestamptz,
  opt_in_source text,
  opt_in_proof jsonb,
  opted_out_at timestamptz,
  suppressed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_e164)
);
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  whatsapp_phone_number_id uuid NOT NULL REFERENCES whatsapp_phone_numbers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PENDING', 'FOLLOW_UP', 'RESOLVED', 'CLOSED')),
  assigned_agent_id uuid REFERENCES users(id),
  priority text NOT NULL DEFAULT 'NORMAL',
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_status ON conversations(organization_id, status);
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX idx_conversation_participants_org ON conversation_participants(organization_id);

CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED')),
  components jsonb NOT NULL DEFAULT '[]',
  variables jsonb NOT NULL DEFAULT '[]',
  meta_template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name, language)
);
CREATE INDEX idx_message_templates_org ON message_templates(organization_id);
CREATE TRIGGER trg_message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id uuid REFERENCES message_templates(id),
  variable_mapping jsonb NOT NULL DEFAULT '{}',
  audience_filter jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED')),
  scheduled_at timestamptz,
  compliance_preflight_passed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED')),
  skip_reason text,
  message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX idx_campaign_recipients_org ON campaign_recipients(organization_id);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);

CREATE TABLE messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  meta_message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  template_id uuid REFERENCES message_templates(id),
  campaign_id uuid REFERENCES campaigns(id),
  pricing_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE messages_default PARTITION OF messages DEFAULT;
CREATE INDEX idx_messages_org ON messages(organization_id, created_at);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_status ON messages(organization_id, status);
CREATE INDEX idx_messages_meta_id ON messages(meta_message_id);

CREATE TABLE message_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  status text NOT NULL,
  raw_payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_statuses_org ON message_statuses(organization_id, message_id);

CREATE TABLE send_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_send_jobs_org ON send_jobs(organization_id);
CREATE INDEX idx_send_jobs_next_run ON send_jobs(status, next_run_at);

-- =========================================================================
-- CRM / leads
-- =========================================================================

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  name text,
  phone text,
  email text,
  source text,
  campaign_id uuid REFERENCES campaigns(id),
  property text,
  budget numeric,
  location text,
  lead_status text NOT NULL DEFAULT 'NEW' CHECK (lead_status IN (
    'NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'
  )),
  lead_score integer,
  assigned_agent_id uuid REFERENCES users(id),
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_leads_status ON leads(organization_id, lead_status);
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_org ON notes(organization_id);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id),
  title text NOT NULL,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_org ON tasks(organization_id);

-- =========================================================================
-- Automation
-- =========================================================================

CREATE TABLE automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_automations_org ON automations(organization_id);
CREATE TRIGGER trg_automations_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_payload jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_automation_runs_org ON automation_runs(organization_id);

-- =========================================================================
-- Billing
-- =========================================================================

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price_monthly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  limits jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations
  ADD CONSTRAINT fk_organizations_plan FOREIGN KEY (plan_id) REFERENCES plans(id);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED')),
  provider text NOT NULL DEFAULT 'razorpay',
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID')),
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_org ON invoices(organization_id);

CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('SUBSCRIPTION', 'AI_USAGE', 'CALLING_USAGE', 'STORAGE', 'OTHER')),
  description text NOT NULL,
  amount numeric NOT NULL,
  quantity numeric NOT NULL DEFAULT 1
);
CREATE INDEX idx_invoice_line_items_org ON invoice_line_items(organization_id);

CREATE TABLE usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  billing_period date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_records_org ON usage_records(organization_id, billing_period);

-- Informational only: Meta bills the client directly under the Tech Provider model.
CREATE TABLE meta_usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  category text NOT NULL,
  destination_country text,
  quantity integer NOT NULL DEFAULT 0,
  meta_cost numeric,
  billing_period date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meta_usage_records_org ON meta_usage_records(organization_id, billing_period);

-- Admin-editable; never hard-code Meta's per-message prices in application code.
CREATE TABLE pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  destination_country text,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- API keys, webhooks
-- =========================================================================

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Not partitioned: event_hash must stay globally unique for dedup, and the
-- natural partition key (created_at = insertion time) would let a retried
-- delivery land in a different partition and defeat that guarantee. Revisit
-- with time-bucketed dedup once volume actually requires partitioning.
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_hash text NOT NULL UNIQUE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id text,
  phone_number_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_webhook_events_org ON webhook_events(organization_id, created_at);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);

CREATE TABLE outbound_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbound_webhooks_org ON outbound_webhooks(organization_id);

CREATE TABLE outbound_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  outbound_webhook_id uuid NOT NULL REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  attempts integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbound_webhook_deliveries_org ON outbound_webhook_deliveries(organization_id);

-- =========================================================================
-- Audit, notifications, flags, data lifecycle
-- =========================================================================

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_org ON notifications(organization_id);

CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  download_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_data_export_requests_org ON data_export_requests(organization_id);

CREATE TABLE deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id),
  scope text NOT NULL CHECK (scope IN ('CONTACT', 'ORGANIZATION')),
  target_id uuid,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_deletion_requests_org ON deletion_requests(organization_id);

-- =========================================================================
-- Row-Level Security
-- =========================================================================
-- The app resolves the caller's organization_id server-side (never from the
-- browser) and runs every tenant-scoped query inside a transaction that
-- starts with: SET LOCAL app.org_id = '<uuid>';  See src/server/db.ts.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'whatsapp_accounts', 'whatsapp_phone_numbers', 'whatsapp_credentials',
    'onboarding_sessions', 'contacts', 'conversations', 'conversation_participants',
    'message_templates', 'campaigns', 'campaign_recipients', 'messages',
    'message_statuses', 'send_jobs', 'leads', 'notes', 'tasks', 'automations',
    'automation_runs', 'subscriptions', 'invoices', 'invoice_line_items',
    'usage_records', 'meta_usage_records', 'api_keys', 'outbound_webhooks',
    'outbound_webhook_deliveries', 'audit_logs', 'notifications', 'feature_flags',
    'data_export_requests', 'deletion_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = app_org_id()) WITH CHECK (organization_id = app_org_id())',
      t
    );
  END LOOP;
END $$;

-- organizations itself: a row is visible to a session scoped to that org,
-- OR to the platform-admin role (set via app.is_platform_admin = 'true').
-- Needed so signup can create the very first org, before any org_id exists.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_self_or_admin ON organizations USING (
  id = app_org_id()
  OR app_is_platform_admin()
) WITH CHECK (
  id = app_org_id()
  OR app_is_platform_admin()
);

-- organization_members gets the same admin bypass as organizations, for the
-- same reason (signup creates the OWNER membership in the same transaction
-- as the org, before app.org_id can be set to the new org's id). Every other
-- tenant table stays isolation-only, with no admin bypass, so a platform
-- admin cannot read customer message content, contacts, etc. by default.
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY org_members_self_or_admin ON organization_members USING (
  organization_id = app_org_id()
  OR app_is_platform_admin()
) WITH CHECK (
  organization_id = app_org_id()
  OR app_is_platform_admin()
);

-- webhook_events: resolved by phone_number_id/waba_id before org_id is known,
-- so isolation is enforced in the service layer (src/server) rather than RLS
-- for the insert path; reads are still scoped once organization_id is set.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_events_read ON webhook_events FOR SELECT USING (
  organization_id = app_org_id()
  OR app_is_platform_admin()
);
CREATE POLICY webhook_events_insert ON webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY webhook_events_update ON webhook_events FOR UPDATE USING (true);
