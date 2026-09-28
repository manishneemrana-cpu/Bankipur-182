"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { getProject } from "@/lib/data/projects";
import { uploadLayoutFile } from "@/lib/storage/layout-files";

export interface UploadState {
  error?: string;
}

/** Upload step (§7.1 step 1): stores the file, creates a draft layout
 * version, and records an extraction job. Automatic vector/AI extraction
 * isn't wired up in this build (honest gap — see the layout page copy), so
 * the job is recorded as a no-op straight away rather than left "queued"
 * forever; every plot is traced by hand in the editor that follows. */
export async function uploadLayout(
  projectId: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a PDF or image file." };
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
    return { error: "Only PDF, PNG or JPG files are supported." };
  }

  const project = await getProject(projectId);
  const supabase = await createClient();

  let fileId: string;
  try {
    ({ fileId } = await uploadLayoutFile(
      supabase,
      project.org_id,
      projectId,
      file,
    ));
  } catch {
    return { error: "Upload failed — please try again." };
  }

  const { count } = await supabase
    .from("layout_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const versionNo = (count ?? 0) + 1;

  const { data: layoutVersion, error: lvError } = await supabase
    .from("layout_versions")
    .insert({
      project_id: projectId,
      version_no: versionNo,
      source_file_id: fileId,
      page_no: 1,
    })
    .select("id")
    .single();
  if (lvError) return { error: lvError.message };

  await supabase.from("extraction_jobs").insert({
    project_id: projectId,
    file_id: fileId,
    kind:
      file.type === "application/pdf" ? "pdf_vector" : "raster_trace_assist",
    status: "succeeded",
    result: {
      auto_extracted_count: 0,
      note: "Automatic layout extraction is not available in this build — trace every plot, road and zone by hand below.",
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}/layout`);
  redirect(`/dashboard/projects/${projectId}/layout/${layoutVersion.id}`);
}

export interface CalibrationInput {
  scaleUnitsPerPx: number;
  unit: "ft" | "m";
  northAngleDeg: number;
}

export async function saveCalibration(
  layoutVersionId: string,
  projectId: string,
  calibration: CalibrationInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("layout_versions")
    .update({
      calibration: {
        scale_units_per_px: calibration.scaleUnitsPerPx,
        unit: calibration.unit,
        north_angle_deg: calibration.northAngleDeg,
      },
    })
    .eq("id", layoutVersionId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}/layout/${layoutVersionId}`);
  return {};
}

export async function publishLayout(
  layoutVersionId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_layout_version", {
    p_layout_version: layoutVersionId,
  });
  if (error) {
    if (error.message.includes("NOTHING_TRACED"))
      return { error: "Trace at least one plot before publishing." };
    if (error.message.includes("OPEN_CONFLICTS"))
      return {
        error:
          "This layout has unresolved data conflicts — resolve them on the Conflicts page before publishing.",
      };
    return { error: error.message };
  }
  revalidatePath(`/dashboard/projects/${projectId}/layout`);
  revalidatePath(`/dashboard/projects/${projectId}/map`);
  return {};
}
