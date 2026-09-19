-- Universal AI UGC Creative & Video Production Engine
-- PostgreSQL schema with Row-Level Security for multi-tenancy + white-label support.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. ORGANIZATIONS (multi-tenancy root, also the white-label unit)
-- =========================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  plan_tier VARCHAR(50) DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'agency', 'enterprise')),
  stripe_customer_id VARCHAR(255),
  -- White-label
  is_white_label BOOLEAN DEFAULT FALSE,
  white_label_domain VARCHAR(255) UNIQUE,
  white_label_name VARCHAR(255),
  white_label_logo_url TEXT,
  white_label_primary_color VARCHAR(7),
  white_label_support_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. USERS
-- =========================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. BRAND KITS
-- =========================================================================
CREATE TABLE brand_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  accent_color VARCHAR(7),
  font_family VARCHAR(100) DEFAULT 'Inter',
  tone_of_voice VARCHAR(100) DEFAULT 'Conversational, energetic, authentic',
  target_demographics JSONB DEFAULT '{}'::jsonb,
  legal_disclaimer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. PRODUCTS & ASSETS
-- =========================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_kit_id UUID NOT NULL REFERENCES brand_kits(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  industry VARCHAR(100) NOT NULL DEFAULT 'general',
  key_benefits TEXT[],
  target_audience TEXT,
  price_offer VARCHAR(100),
  cta_text VARCHAR(100) DEFAULT 'Shop Now',
  reference_assets JSONB DEFAULT '[]'::jsonb, -- [{type: 'front'|'back'|'side'|'logo'|'lifestyle', url: string}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 5. CREATOR PROFILES (reusable UGC "actor" presets)
-- =========================================================================
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  archetype VARCHAR(100) NOT NULL, -- 'young_female', 'founder', 'expert', 'customer', ...
  demographic JSONB NOT NULL DEFAULT '{}'::jsonb, -- age, gender, ethnicity
  appearance JSONB NOT NULL DEFAULT '{}'::jsonb, -- hair, clothing, distinguishing features
  personality TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 6. PROJECTS & CAMPAIGNS
-- =========================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  creator_profile_id UUID REFERENCES creator_profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  mode VARCHAR(20) DEFAULT 'simple' CHECK (mode IN ('simple', 'pro_studio', 'autopilot')),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'failed')),
  aspect_ratio VARCHAR(10) DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9', '1:1')),
  target_duration_seconds INT DEFAULT 30,
  language VARCHAR(50) DEFAULT 'English',
  voice_language VARCHAR(50) DEFAULT 'English',
  subtitle_language VARCHAR(50) DEFAULT 'English',
  platform_preset VARCHAR(50), -- 'instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin', ...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. CREATIVE STRATEGIES & SCRIPTS (versioned, never overwritten)
-- =========================================================================
CREATE TABLE creative_strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audience_psychology JSONB NOT NULL,
  hooks JSONB NOT NULL,          -- all generated hook candidates + scores
  selected_hook JSONB NOT NULL,  -- {type, script, visualDirection, viralityScore}
  creative_angle VARCHAR(100) NOT NULL,
  creative_framework VARCHAR(100) NOT NULL,
  target_persona JSONB NOT NULL,
  script_json JSONB NOT NULL,          -- full scene-by-scene narrative
  continuity_bible JSONB NOT NULL,     -- character, environment, product rules
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 8. GENERATION JOBS (async job state machine)
-- =========================================================================
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bullmq_job_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'qc_rejected')),
  current_step VARCHAR(100) DEFAULT 'INITIALIZING',
  step_progress INT DEFAULT 0,
  cache_key VARCHAR(64), -- md5 hash of normalized input for dedupe/caching
  cost_estimate_usd NUMERIC(10, 4) DEFAULT 0.0000,
  actual_cost_usd NUMERIC(10, 4) DEFAULT 0.0000,
  retry_count INT DEFAULT 0,
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 9. SCENES & SCENE ASSETS (independently lockable/regeneratable)
-- =========================================================================
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INT NOT NULL,
  duration_seconds INT NOT NULL,
  purpose VARCHAR(50) NOT NULL, -- 'Hook', 'Problem', 'Solution', 'Demo', 'Proof', 'CTA', ...
  dialogue TEXT,
  visual_description TEXT NOT NULL,
  raw_prompt TEXT NOT NULL,
  negative_prompt TEXT,
  camera_settings JSONB NOT NULL,
  character_settings JSONB NOT NULL,
  provider_used VARCHAR(50) DEFAULT 'google-veo-2',
  provider_job_id VARCHAR(255),
  video_asset_url TEXT,
  audio_asset_url TEXT,
  cache_key VARCHAR(64),
  is_locked BOOLEAN DEFAULT FALSE,
  qc_passed BOOLEAN DEFAULT FALSE,
  qc_feedback JSONB DEFAULT '{}'::jsonb,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, scene_number)
);

-- =========================================================================
-- 10. RENDERS & FINAL DELIVERABLES (versioned, never destructively overwritten)
-- =========================================================================
CREATE TABLE renders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  master_video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  subtitles_vtt_url TEXT,
  aspect_ratio VARCHAR(10) NOT NULL,
  resolution VARCHAR(20) DEFAULT '1080x1920',
  platform_variant VARCHAR(50), -- null = master, else 'instagram_reels', 'youtube_shorts', ...
  duration_seconds INT,
  file_size_bytes BIGINT,
  render_engine VARCHAR(50) DEFAULT 'ffmpeg',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 11. USAGE & BILLING
-- =========================================================================
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'scene_generation', 'voice_synthesis', 'render', 'qc_check'
  provider VARCHAR(50),
  units NUMERIC(10, 4) NOT NULL DEFAULT 0, -- seconds, characters, renders
  cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 12. AUDIT LOGS
-- =========================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 13. INDUSTRY TEMPLATES (admin-editable overrides of the built-in registry)
-- =========================================================================
CREATE TABLE industry_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global default
  industry_key VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, industry_key)
);

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_brand_kits_org ON brand_kits(organization_id);
CREATE INDEX idx_products_brand ON products(brand_kit_id);
CREATE INDEX idx_creator_profiles_org ON creator_profiles(organization_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_strategies_project ON creative_strategies(project_id);
CREATE INDEX idx_scenes_project_scene ON scenes(project_id, scene_number);
CREATE INDEX idx_jobs_project ON generation_jobs(project_id);
CREATE INDEX idx_jobs_cache_key ON generation_jobs(cache_key);
CREATE INDEX idx_scenes_cache_key ON scenes(cache_key);
CREATE INDEX idx_renders_project ON renders(project_id);
CREATE INDEX idx_usage_org ON usage_events(organization_id, created_at);
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at);

-- =========================================================================
-- ROW-LEVEL SECURITY (tenant isolation on every organization-scoped table)
-- =========================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON users
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_brand_kits ON brand_kits
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_products ON products
  USING (brand_kit_id IN (SELECT id FROM brand_kits WHERE organization_id = current_setting('app.current_organization_id')::uuid));
CREATE POLICY tenant_isolation_creator_profiles ON creator_profiles
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_projects ON projects
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_strategies ON creative_strategies
  USING (project_id IN (SELECT id FROM projects WHERE organization_id = current_setting('app.current_organization_id')::uuid));
CREATE POLICY tenant_isolation_jobs ON generation_jobs
  USING (project_id IN (SELECT id FROM projects WHERE organization_id = current_setting('app.current_organization_id')::uuid));
CREATE POLICY tenant_isolation_scenes ON scenes
  USING (project_id IN (SELECT id FROM projects WHERE organization_id = current_setting('app.current_organization_id')::uuid));
CREATE POLICY tenant_isolation_renders ON renders
  USING (project_id IN (SELECT id FROM projects WHERE organization_id = current_setting('app.current_organization_id')::uuid));
CREATE POLICY tenant_isolation_usage ON usage_events
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_audit ON audit_logs
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY tenant_isolation_industry_templates ON industry_templates
  USING (organization_id IS NULL OR organization_id = current_setting('app.current_organization_id')::uuid);
