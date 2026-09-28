"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { parseInventoryCsv, type RowResult } from "@/lib/import/csv";

export interface ValidateState {
  error?: string;
  importId?: string;
  fileName?: string;
  results?: RowResult[];
  validCount?: number;
  applied?: boolean;
}

export async function validateImport(
  projectId: string,
  _prev: ValidateState,
  formData: FormData,
): Promise<ValidateState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a CSV file." };

  const text = await file.text();
  const { results, validRows, hasErrors } = parseInventoryCsv(text);
  if (results.length === 0) return { error: "The file has no data rows." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_imports")
    .insert({
      project_id: projectId,
      file_name: file.name,
      status: hasErrors ? "has_errors" : "ready",
      row_results: results,
      summary: {
        total: results.length,
        valid: validRows.length,
        invalid: results.length - validRows.length,
      },
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  return {
    importId: data.id,
    fileName: file.name,
    results,
    validCount: validRows.length,
  };
}

export async function applyImport(
  projectId: string,
  importId: string,
  _prev: ValidateState,
): Promise<ValidateState> {
  const supabase = await createClient();
  const { data: imp, error: fetchErr } = await supabase
    .from("inventory_imports")
    .select("row_results")
    .eq("id", importId)
    .single();
  if (fetchErr) return { error: fetchErr.message, importId };

  const results = (imp.row_results ?? []) as RowResult[];
  const validRows = results.flatMap((r) => (r.data ? [r.data] : []));
  if (validRows.length === 0)
    return { error: "No valid rows to apply.", importId, results };

  const { error } = await supabase.rpc("apply_inventory_import", {
    p_import: importId,
    p_rows: validRows,
  });
  if (error) return { error: error.message, importId, results };

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/import`);
  return { importId, results, validCount: validRows.length, applied: true };
}
