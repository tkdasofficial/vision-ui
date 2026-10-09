// In-browser database: every table is an array of rows saved in localStorage.
// Data lives only in this browser on this device.

const DB_KEY = "sc_local_db_v1";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

let cache: Tables | null = null;

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

export function loadDb(): Tables {
  if (cache) return cache;
  if (!hasStorage()) return (cache = {});
  try {
    cache = JSON.parse(window.localStorage.getItem(DB_KEY) || "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

export function saveDb() {
  if (!hasStorage() || !cache) return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[local-backend] storage full, changes not saved", e);
  }
}

export function table(name: string): Row[] {
  const db = loadDb();
  if (!db[name]) db[name] = [];
  return db[name]!;
}

export function setTable(name: string, rows: Row[]) {
  loadDb()[name] = rows;
  saveDb();
}

export function uuid() {
  return crypto.randomUUID();
}

// ── change notifications (powers supabase-style realtime channels) ──
type ChangeEvent = { table: string; eventType: "INSERT" | "UPDATE" | "DELETE"; new: Row; old: Row };
const listeners = new Set<(e: ChangeEvent) => void>();
export function onChange(fn: (e: ChangeEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emitChange(e: ChangeEvent) {
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch (err) {
      console.error(err);
    }
  });
}
