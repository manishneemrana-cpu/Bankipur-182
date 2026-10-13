import type { ProjectRow } from "@ave/shared-types";
import { config } from "../config.js";
import { log } from "./logger.js";
import { repo } from "./repo.js";

/** In-app notification always; webhook / email relay when configured in account settings. */
export async function notifyProjectResult(project: ProjectRow, kind: "project_done" | "project_failed") {
  const name = project.input.name;
  const message = kind === "project_done" ? `Your video for “${name}” is ready.` : `Video generation failed for “${name}”: ${project.error ?? "unknown error"}`;
  await repo.addNotification({ accountId: project.accountId, projectId: project.id, kind, message });

  const settings = project.settingsSnapshot ?? (await repo.getSettings(project.accountId));
  const payload = { event: kind, projectId: project.id, projectName: name, message, videoUrls: project.assets.videoUrls ?? {}, error: project.error };

  if (settings.notifyWebhookUrl) {
    try {
      const res = await fetch(settings.notifyWebhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) log.warn({ status: res.status }, "notify webhook non-2xx");
    } catch (err) { log.warn({ err }, "notify webhook failed"); }
  }
  if (settings.notifyEmail && config.EMAIL_WEBHOOK_URL) {
    try {
      await fetch(config.EMAIL_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: settings.notifyEmail, subject: message, text: JSON.stringify(payload, null, 2) }), signal: AbortSignal.timeout(10_000) });
    } catch (err) { log.warn({ err }, "notify email relay failed"); }
  }
}
