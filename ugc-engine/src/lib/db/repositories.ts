import type { PoolClient } from "pg";
import { withTenant } from "./client";
import type { ProductInput } from "@/types/project";
import type { CreativeStrategyOutput, StoryboardScene } from "@/types/agents";
import type { PipelineStep } from "@/types/jobs";

export interface ProjectRow {
  id: string;
  organization_id: string;
  product_id: string;
  title: string;
  mode: string;
  status: string;
  aspect_ratio: string;
  target_duration_seconds: number;
  language: string;
  created_at: string;
  updated_at: string;
}

export const ProductRepository = {
  async create(organizationId: string, brandKitId: string, input: ProductInput): Promise<string> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO products (brand_kit_id, name, description, category, industry, key_benefits, target_audience, price_offer, cta_text, reference_assets)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          brandKitId,
          input.productName,
          input.description,
          input.category ?? null,
          input.industry,
          input.keyBenefits,
          input.targetAudience,
          input.priceOffer ?? null,
          input.ctaText,
          JSON.stringify(input.referenceAssets ?? []),
        ]
      );
      return rows[0].id;
    });
  },
};

export const ProjectRepository = {
  async create(organizationId: string, productId: string, input: ProductInput, title: string): Promise<ProjectRow> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<ProjectRow>(
        `INSERT INTO projects (organization_id, product_id, title, mode, aspect_ratio, target_duration_seconds, language, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued') RETURNING *`,
        [organizationId, productId, title, input.mode, input.aspectRatio, input.durationSeconds, input.language]
      );
      return rows[0];
    });
  },

  async get(organizationId: string, projectId: string): Promise<ProjectRow | null> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<ProjectRow>(`SELECT * FROM projects WHERE id = $1`, [projectId]);
      return rows[0] ?? null;
    });
  },

  async updateStatus(organizationId: string, projectId: string, status: string): Promise<void> {
    await withTenant(organizationId, async (client) => {
      await client.query(`UPDATE projects SET status = $2, updated_at = now() WHERE id = $1`, [projectId, status]);
    });
  },
};

export const StrategyRepository = {
  async save(organizationId: string, projectId: string, strategy: CreativeStrategyOutput): Promise<string> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO creative_strategies
           (project_id, audience_psychology, hooks, selected_hook, creative_angle, creative_framework, target_persona, script_json, continuity_bible)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          projectId,
          JSON.stringify(strategy.audiencePsychology),
          JSON.stringify(strategy.hooks),
          JSON.stringify(strategy.selectedHook),
          strategy.creativeConcept.angle,
          strategy.creativeConcept.framework,
          JSON.stringify(strategy.audiencePsychology), // target persona derived from audience psychology in this scaffold
          JSON.stringify(strategy.script),
          JSON.stringify(strategy.continuityBible),
        ]
      );
      return rows[0].id;
    });
  },
};

export const SceneRepository = {
  async upsertFromStoryboard(organizationId: string, projectId: string, storyboard: StoryboardScene[]): Promise<void> {
    await withTenant(organizationId, async (client) => {
      for (const scene of storyboard) {
        await client.query(
          `INSERT INTO scenes (project_id, scene_number, duration_seconds, purpose, dialogue, visual_description, raw_prompt, negative_prompt, camera_settings, character_settings)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (project_id, scene_number) DO UPDATE SET
             duration_seconds = EXCLUDED.duration_seconds,
             purpose = EXCLUDED.purpose,
             dialogue = EXCLUDED.dialogue,
             visual_description = EXCLUDED.visual_description,
             raw_prompt = EXCLUDED.raw_prompt,
             negative_prompt = EXCLUDED.negative_prompt,
             camera_settings = EXCLUDED.camera_settings,
             character_settings = EXCLUDED.character_settings,
             updated_at = now()
           WHERE scenes.is_locked = FALSE`,
          [
            projectId,
            scene.sceneNumber,
            scene.duration,
            scene.purpose,
            scene.dialogue,
            scene.visualDescription,
            scene.modelPrompt,
            scene.negativePrompt,
            JSON.stringify(scene.camera),
            JSON.stringify({ characterAction: scene.characterAction, productInteraction: scene.productInteraction }),
          ]
        );
      }
    });
  },

  async markResult(
    organizationId: string,
    projectId: string,
    sceneNumber: number,
    result: { videoAssetUrl: string; qcPassed: boolean; qcFeedback: unknown; providerUsed: string; providerJobId: string }
  ): Promise<void> {
    await withTenant(organizationId, async (client) => {
      await client.query(
        `UPDATE scenes SET video_asset_url = $3, qc_passed = $4, qc_feedback = $5, provider_used = $6, provider_job_id = $7,
           is_locked = $4, attempt_count = attempt_count + 1, updated_at = now()
         WHERE project_id = $1 AND scene_number = $2`,
        [projectId, sceneNumber, result.videoAssetUrl, result.qcPassed, JSON.stringify(result.qcFeedback), result.providerUsed, result.providerJobId]
      );
    });
  },

  async listLockedVideoUrls(organizationId: string, projectId: string): Promise<Array<{ sceneNumber: number; videoAssetUrl: string }>> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ scene_number: number; video_asset_url: string }>(
        `SELECT scene_number, video_asset_url FROM scenes WHERE project_id = $1 AND is_locked = TRUE ORDER BY scene_number ASC`,
        [projectId]
      );
      return rows.map((r) => ({ sceneNumber: r.scene_number, videoAssetUrl: r.video_asset_url }));
    });
  },
};

export const JobRepository = {
  async create(organizationId: string, projectId: string, cacheKey: string, costEstimateUsd: number): Promise<string> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO generation_jobs (project_id, cache_key, cost_estimate_usd) VALUES ($1, $2, $3) RETURNING id`,
        [projectId, cacheKey, costEstimateUsd]
      );
      return rows[0].id;
    });
  },

  async updateProgress(organizationId: string, jobId: string, step: PipelineStep, progress: number): Promise<void> {
    await withTenant(organizationId, async (client) => {
      await client.query(
        `UPDATE generation_jobs SET current_step = $2, step_progress = $3, status = 'processing', updated_at = now() WHERE id = $1`,
        [jobId, step, progress]
      );
    });
  },

  async complete(organizationId: string, jobId: string, actualCostUsd: number): Promise<void> {
    await withTenant(organizationId, async (client) => {
      await client.query(
        `UPDATE generation_jobs SET status = 'succeeded', current_step = 'COMPLETED', step_progress = 100, actual_cost_usd = $2, updated_at = now() WHERE id = $1`,
        [jobId, actualCostUsd]
      );
    });
  },

  async fail(organizationId: string, jobId: string, errorLog: string): Promise<void> {
    await withTenant(organizationId, async (client) => {
      await client.query(
        `UPDATE generation_jobs SET status = 'failed', error_log = $2, updated_at = now() WHERE id = $1`,
        [jobId, errorLog]
      );
    });
  },

  async get(organizationId: string, jobId: string): Promise<Record<string, unknown> | null> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query(`SELECT * FROM generation_jobs WHERE id = $1`, [jobId]);
      return rows[0] ?? null;
    });
  },
};

export const RenderRepository = {
  async save(
    organizationId: string,
    projectId: string,
    render: { masterVideoUrl: string; thumbnailUrl: string; subtitlesVttUrl: string; aspectRatio: string; durationSeconds: number }
  ): Promise<string> {
    return withTenant(organizationId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO renders (project_id, master_video_url, thumbnail_url, subtitles_vtt_url, aspect_ratio, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [projectId, render.masterVideoUrl, render.thumbnailUrl, render.subtitlesVttUrl, render.aspectRatio, render.durationSeconds]
      );
      return rows[0].id;
    });
  },
};

export const UsageRepository = {
  async record(
    client: PoolClient | null,
    organizationId: string,
    event: { projectId?: string; eventType: string; provider?: string; units: number; costUsd: number }
  ): Promise<void> {
    await withTenant(organizationId, async (c) => {
      await (client ?? c).query(
        `INSERT INTO usage_events (organization_id, project_id, event_type, provider, units, cost_usd) VALUES ($1, $2, $3, $4, $5, $6)`,
        [organizationId, event.projectId ?? null, event.eventType, event.provider ?? null, event.units, event.costUsd]
      );
    });
  },
};
