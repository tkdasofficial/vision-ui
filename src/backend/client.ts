// Local backend entry point. Mirrors the small slice of the Supabase client API
// the app uses, but everything runs and is stored inside the visitor's browser.
import { QueryBuilder } from "./query";
import { auth } from "./auth";
import { onChange } from "./db";

function channel(_name: string) {
  const subs: (() => void)[] = [];
  const ch: any = {
    on(_type: string, opts: { table?: string; event?: string; filter?: string }, cb: (p: any) => void) {
      const [fCol, fRest] = (opts.filter ?? "").split("=");
      const fVal = fRest?.replace(/^eq\./, "");
      subs.push(() => {}); // placeholder index
      const off = onChange((e) => {
        if (opts.table && opts.table !== e.table) return;
        if (opts.event && opts.event !== "*" && opts.event !== e.eventType) return;
        const row = e.eventType === "DELETE" ? e.old : e.new;
        if (fCol && fVal !== undefined && String(row[fCol]) !== fVal) return;
        cb({ eventType: e.eventType, new: e.new, old: e.old, table: e.table, schema: "public" });
      });
      subs[subs.length - 1] = () => { off(); };
      return ch;
    },
    subscribe(cb?: (status: string) => void) { cb?.("SUBSCRIBED"); return ch; },
    unsubscribe() { subs.forEach((s) => s()); return Promise.resolve("ok"); },
  };
  return ch;
}

const OFFLINE = "This feature needs an online AI service, which isn't part of the browser-only version.";

export const supabase: any = {
  from: (name: string) => new QueryBuilder(name),
  auth,
  channel,
  removeChannel: (ch: any) => ch?.unsubscribe?.(),
  rpc: async (_fn: string, _args?: any) => ({ data: null, error: null }),
  functions: {
    invoke: async (_name: string, _opts?: any) => ({ data: null, error: { message: OFFLINE } }),
  },
};

export const LOCAL_AI_UNAVAILABLE = OFFLINE;
