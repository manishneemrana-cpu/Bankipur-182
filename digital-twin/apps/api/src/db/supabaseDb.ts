import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Db, Row, TableName, Where } from './types.js';

const PAGE = 1000;

/** Postgres-backed store via the service key (server only). Run supabase/migrations/0001_init.sql first. */
export class SupabaseDb implements Db {
  private c: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.c = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private fail(error: { message: string; code?: string } | null): never | void {
    if (!error) return;
    throw Object.assign(new Error(error.message), { code: error.code === '23505' ? 'conflict' : error.code === '23503' ? 'fk' : 'db' });
  }

  async list(table: TableName, where: Where = {}, opts?: { since?: string }) {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.c.from(table).select('*').range(from, from + PAGE - 1);
      for (const [k, v] of Object.entries(where)) q = v === null ? q.is(k, null) : q.eq(k, v);
      if (opts?.since) q = q.gte('created_at', opts.since);
      const { data, error } = await q;
      this.fail(error);
      out.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  async get(table: TableName, id: string) {
    const { data, error } = await this.c.from(table).select('*').eq('id', id).maybeSingle();
    this.fail(error);
    return (data as Row) ?? null;
  }
  async insert(table: TableName, rows: Omit<Row, 'id'>[] | Omit<Row, 'id'>) {
    const arr = Array.isArray(rows) ? rows : [rows];
    const out: Row[] = [];
    for (let i = 0; i < arr.length; i += 500) {
      const { data, error } = await this.c.from(table).insert(arr.slice(i, i + 500)).select();
      this.fail(error);
      out.push(...((data ?? []) as Row[]));
    }
    return out;
  }
  async update(table: TableName, id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.c.from(table).update(patch).eq('id', id).select().maybeSingle();
    this.fail(error);
    return (data as Row) ?? null;
  }
  async remove(table: TableName, where: Where) {
    let q = this.c.from(table).delete({ count: 'exact' });
    for (const [k, v] of Object.entries(where)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { count, error } = await q;
    this.fail(error);
    return count ?? 0;
  }

  /** Exposed for the storage adapter so both share one client. */
  get client() { return this.c; }
}
