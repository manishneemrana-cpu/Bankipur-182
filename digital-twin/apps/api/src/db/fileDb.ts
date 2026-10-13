import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Db, Row, TableName, Where } from './types.js';

type Tables = Record<TableName, Row[]>;
const EMPTY = (): Tables => ({ projects: [], towers: [], floors: [], unit_types: [], units: [], hotspots: [], analytics_events: [], floorplan_analyses: [] });

/** JSON-file store for local development and demos. Single-process only – use SupabaseDb in production. */
export class FileDb implements Db {
  private t: Tables = EMPTY();
  private writing: Promise<void> = Promise.resolve();
  private constructor(private file: string) {}

  static async open(file: string, seedFile?: string): Promise<FileDb> {
    const db = new FileDb(file);
    if (existsSync(file)) {
      db.t = { ...EMPTY(), ...JSON.parse(await readFile(file, 'utf8')) };
    } else if (seedFile && existsSync(seedFile)) {
      db.t = { ...EMPTY(), ...JSON.parse(await readFile(seedFile, 'utf8')) };
      await db.flush();
    }
    return db;
  }

  private flush(): Promise<void> {
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.t));
      await rename(tmp, this.file);
    });
    return this.writing;
  }

  private match(r: Row, where?: Where) {
    return !where || Object.entries(where).every(([k, v]) => r[k] === v);
  }

  async list(table: TableName, where?: Where, opts?: { since?: string }) {
    return this.t[table].filter((r) => this.match(r, where) && (!opts?.since || (r.created_at ?? '') >= opts.since)).map((r) => structuredClone(r));
  }
  async get(table: TableName, id: string) {
    const r = this.t[table].find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }
  async insert(table: TableName, rows: Omit<Row, 'id'>[] | Omit<Row, 'id'>) {
    const arr = Array.isArray(rows) ? rows : [rows];
    const made = arr.map((r) => ({ id: randomUUID(), ...(table === 'analytics_events' || table === 'floorplan_analyses' ? { created_at: new Date().toISOString() } : {}), ...r }) as Row);
    this.checkUnique(table, made);
    this.t[table].push(...made);
    await this.flush();
    return structuredClone(made);
  }
  async update(table: TableName, id: string, patch: Record<string, unknown>) {
    const r = this.t[table].find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    await this.flush();
    return structuredClone(r);
  }
  async remove(table: TableName, where: Where) {
    const before = this.t[table].length;
    this.t[table] = this.t[table].filter((r) => !this.match(r, where));
    const n = before - this.t[table].length;
    if (n) await this.flush();
    return n;
  }

  /** Mirrors the unique constraints in the SQL schema so dev and prod behave the same. */
  private checkUnique(table: TableName, rows: Row[]) {
    const keys: Partial<Record<TableName, string[]>> = { projects: ['slug'], floors: ['tower_id', 'floor_number'], unit_types: ['project_id', 'code'], units: ['tower_id', 'label'] };
    const k = keys[table];
    if (!k) return;
    const sig = (r: Row) => k.map((f) => String(r[f])).join('|');
    const seen = new Set(this.t[table].map(sig));
    for (const r of rows) {
      if (seen.has(sig(r))) throw Object.assign(new Error(`duplicate ${table} (${k.join(', ')})`), { code: 'conflict' });
      seen.add(sig(r));
    }
  }
}
