export type TableName =
  | 'projects' | 'towers' | 'floors' | 'unit_types' | 'units' | 'hotspots' | 'analytics_events' | 'floorplan_analyses';

export type Row = Record<string, any> & { id: string };
export type Where = Record<string, string | number | boolean | null>;

/** Minimal persistence port. Implemented by FileDb (dev/demo) and SupabaseDb (production). */
export interface Db {
  list(table: TableName, where?: Where, opts?: { since?: string }): Promise<Row[]>;
  get(table: TableName, id: string): Promise<Row | null>;
  insert(table: TableName, rows: Omit<Row, 'id'>[] | Omit<Row, 'id'>): Promise<Row[]>;
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<Row | null>;
  remove(table: TableName, where: Where): Promise<number>;
}
