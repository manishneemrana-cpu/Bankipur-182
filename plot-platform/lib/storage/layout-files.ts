import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-files";
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);

export function isAcceptedLayoutFile(mime: string): boolean {
  return ACCEPTED_MIME.has(mime);
}

/** Uploads a layout source file under {project_id}/{file_id}.{ext} (§7.1
 * step 1) and records it in `files`. Storage RLS (§7 migration) restricts
 * both the upload and any later read to this project's members. */
export async function uploadLayoutFile(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  file: File,
): Promise<{ fileId: string; storagePath: string }> {
  if (!isAcceptedLayoutFile(file.type)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const fileId = randomUUID();
  const storagePath = `${projectId}/${fileId}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await crypto.subtle
    .digest("SHA-256", bytes)
    .then((buf) => Buffer.from(buf).toString("hex"));

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("files")
    .insert({
      id: fileId,
      org_id: orgId,
      project_id: projectId,
      storage_path: storagePath,
      original_name: file.name,
      mime: file.type,
      size: file.size,
      sha256,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { fileId: data.id, storagePath };
}

/** A signed URL a project member can use to view the source file in the
 * tracing editor — the bucket is private, so this is the only way in. */
export async function signedLayoutFileUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
