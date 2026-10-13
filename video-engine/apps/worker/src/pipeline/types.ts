import type { AccountSettings, ProjectRow, Stage } from "@ave/shared-types";

export interface StageContext {
  project: ProjectRow;
  /** Provider/brand settings frozen at submission time. */
  settings: AccountSettings;
  stage: Stage;
  /** 0..100 progress, persisted to the jobs table for the UI. */
  progress(pct: number): Promise<void>;
  /** Persist a file under this project's storage prefix and return its public URL. */
  save(name: string, data: Buffer, contentType: string): Promise<string>;
  /** Record which provider actually served this stage (shown in UI). */
  setProvider(id: string): Promise<void>;
  /** Mark this stage as skipped (e.g. no elevation image) with a reason. */
  skip(reason: string): Promise<void>;
}

export type StageHandler = (ctx: StageContext) => Promise<void>;
