// Supabase-compatible query builder running against the in-browser database.
import { table, setTable, saveDb, uuid, emitChange } from "./db";

type Row = Record<string, any>;
type Filter = (r: Row) => boolean;
type Result = { data: any; error: any; count?: number | null };

const get = (r: Row, col: string) => {
  // support json paths like "params->>niche"
  const [c, ...path] = col.split(/->>?/);
  let v = r[c!];
  for (const p of path) v = v?.[p];
  return v;
};

const likeToRegex = (p: string, flags = "") =>
  new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", flags);

function parseList(v: string) {
  return v.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

function opFilter(col: string, op: string, val: any): Filter {
  switch (op) {
    case "eq": return (r) => get(r, col) == val;
    case "neq": return (r) => get(r, col) != val;
    case "gt": return (r) => get(r, col) > val;
    case "gte": return (r) => get(r, col) >= val;
    case "lt": return (r) => get(r, col) < val;
    case "lte": return (r) => get(r, col) <= val;
    case "in": {
      const list = Array.isArray(val) ? val : parseList(String(val));
      return (r) => list.some((x: any) => x == get(r, col));
    }
    case "is": return (r) => (val === null ? get(r, col) == null : get(r, col) === val);
    case "like": return (r) => likeToRegex(String(val)).test(String(get(r, col) ?? ""));
    case "ilike": return (r) => likeToRegex(String(val), "i").test(String(get(r, col) ?? ""));
    case "contains": return (r) => {
      const v = get(r, col);
      if (Array.isArray(v)) return (Array.isArray(val) ? val : [val]).every((x: any) => v.includes(x));
      if (v && typeof v === "object") return Object.entries(val).every(([k, x]) => v[k] == x);
      return String(v ?? "").includes(String(val));
    };
    default: return () => true;
  }
}

function parseOr(expr: string): Filter {
  const parts = expr.split(/,(?![^(]*\))/).map((p) => {
    const [col, op, ...rest] = p.split(".");
    const raw = rest.join(".");
    const val = raw === "null" ? null : raw;
    return opFilter(col!, op!, op === "in" ? parseList(raw) : val);
  });
  return (r) => parts.some((f) => f(r));
}

export class QueryBuilder implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private upsertKey = "id";
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private countMode = false;
  private head = false;
  private returning = false;

  constructor(private name: string, private defaults: () => Row = () => ({})) {}

  select(_cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.action !== "select") this.returning = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.action = "insert"; this.payload = rows; return this; }
  update(patch: Row) { this.action = "update"; this.payload = patch; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.action = "upsert"; this.payload = rows; if (opts?.onConflict) this.upsertKey = opts.onConflict; return this;
  }
  delete() { this.action = "delete"; return this; }

  eq(c: string, v: any) { this.filters.push(opFilter(c, "eq", v)); return this; }
  neq(c: string, v: any) { this.filters.push(opFilter(c, "neq", v)); return this; }
  gt(c: string, v: any) { this.filters.push(opFilter(c, "gt", v)); return this; }
  gte(c: string, v: any) { this.filters.push(opFilter(c, "gte", v)); return this; }
  lt(c: string, v: any) { this.filters.push(opFilter(c, "lt", v)); return this; }
  lte(c: string, v: any) { this.filters.push(opFilter(c, "lte", v)); return this; }
  in(c: string, v: any[]) { this.filters.push(opFilter(c, "in", v)); return this; }
  is(c: string, v: any) { this.filters.push(opFilter(c, "is", v)); return this; }
  like(c: string, v: string) { this.filters.push(opFilter(c, "like", v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opFilter(c, "ilike", v)); return this; }
  contains(c: string, v: any) { this.filters.push(opFilter(c, "contains", v)); return this; }
  match(obj: Row) { Object.entries(obj).forEach(([c, v]) => this.eq(c, v)); return this; }
  filter(c: string, op: string, v: any) { this.filters.push(opFilter(c, op, v)); return this; }
  not(c: string, op: string, v: any) { const f = opFilter(c, op, v); this.filters.push((r) => !f(r)); return this; }
  or(expr: string) { this.filters.push(parseOr(expr)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending ?? true }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private matches(r: Row) { return this.filters.every((f) => f(r)); }

  private withDefaults(r: Row): Row {
    const now = new Date().toISOString();
    return { id: uuid(), created_at: now, updated_at: now, ...this.defaults(), ...r };
  }

  private run(): Result {
    const rows = table(this.name);
    let out: Row[] = [];

    if (this.action === "insert" || this.action === "upsert") {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({ ...r }));
      for (const r of list) {
        const keys = this.upsertKey.split(",").map((k) => k.trim());
        const existing = this.action === "upsert" ? rows.find((x) => keys.every((k) => r[k] !== undefined && x[k] == r[k])) : undefined;
        if (existing) {
          const old = { ...existing };
          Object.assign(existing, r, { updated_at: new Date().toISOString() });
          out.push(existing);
          emitChange({ table: this.name, eventType: "UPDATE", new: existing, old });
        } else {
          const row = this.withDefaults(r);
          rows.push(row);
          out.push(row);
          emitChange({ table: this.name, eventType: "INSERT", new: row, old: {} });
        }
      }
      saveDb();
    } else if (this.action === "update") {
      for (const r of rows) {
        if (!this.matches(r)) continue;
        const old = { ...r };
        Object.assign(r, this.payload, { updated_at: new Date().toISOString() });
        out.push(r);
        emitChange({ table: this.name, eventType: "UPDATE", new: r, old });
      }
      saveDb();
    } else if (this.action === "delete") {
      const keep: Row[] = [];
      for (const r of rows) {
        if (this.matches(r)) { out.push(r); emitChange({ table: this.name, eventType: "DELETE", new: {}, old: r }); }
        else keep.push(r);
      }
      setTable(this.name, keep);
    } else {
      out = rows.filter((r) => this.matches(r));
    }

    if (this.action !== "select" && !this.returning) return { data: null, error: null };

    const count = out.length;
    if (this.orders.length) {
      out = [...out].sort((a, b) => {
        for (const { col, asc } of this.orders) {
          const x = get(a, col), y = get(b, col);
          if (x == y) continue;
          if (x == null) return 1;
          if (y == null) return -1;
          return (x > y ? 1 : -1) * (asc ? 1 : -1);
        }
        return 0;
      });
    }
    if (this.rangeFrom !== null) out = out.slice(this.rangeFrom, (this.rangeTo ?? out.length) + 1);
    if (this.lim !== null) out = out.slice(0, this.lim);
    const data = JSON.parse(JSON.stringify(out));

    if (this.head) return { data: null, error: null, count };
    if (this.mode === "single") {
      if (data.length !== 1) return { data: null, error: { message: "Row not found", code: "PGRST116" }, count: null };
      return { data: data[0], error: null, count: this.countMode ? count : null };
    }
    if (this.mode === "maybe") return { data: data[0] ?? null, error: null };
    return { data, error: null, count: this.countMode ? count : null };
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null) {
    return new Promise<Result>((resolve) => {
      try { resolve(this.run()); }
      catch (e: any) { resolve({ data: null, error: { message: e?.message ?? String(e) } }); }
    }).then(ok, fail);
  }
}
