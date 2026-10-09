import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractEmails } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA_POOL = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/126.0",
];
const SUBPATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/team"];

const jitter = (a: number, b: number) => new Promise((r) => setTimeout(r, a + Math.random() * (b - a)));

async function scrapeDomain(domain: string): Promise<string[]> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const emails = new Set<string>();
  for (const sub of SUBPATHS) {
    try {
      const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
      const res = await fetch(base + sub, {
        headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Strip script/style before regex
      const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
      extractEmails(cleaned).forEach((e) => emails.add(e));
      await jitter(2000, 4000);
    } catch (_) { /* skip */ }
    if (emails.size >= 3) break;
  }
  return [...emails];
}

async function geminiDiscover(niche: string, target: number, apiKey: string): Promise<Array<{ company: string; domain: string; industry: string }>> {
  const prompt = `Return a JSON array of ${target} real, currently active companies matching: "${niche}". Each item MUST have keys: company (string, real business name), domain (string, plain domain like example.com, no protocol), industry (string). Output only the JSON array, no markdown.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "google_search" }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini discovery ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authH = req.headers.get("Authorization");
    if (!authH) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authH } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { jobId } = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: job } = await admin.from("prospecting_jobs").select("*").eq("id", jobId).eq("user_id", user.id).single();
    if (!job) return json({ error: "Job not found" }, 404);

    const params = job.params || {};
    const niche: string = params.niche || "";
    const target: number = job.target_count || 25;

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      await admin.from("prospecting_jobs").update({ status: "error", error: "LOVABLE_API_KEY missing" }).eq("id", jobId);
      return json({ error: "LOVABLE_API_KEY missing" }, 500);
    }

    await admin.from("prospecting_jobs").update({ status: "running" }).eq("id", jobId);

    const candidates = await geminiDiscover(niche, Math.min(target * 3, 60), lovableKey);
    let found = 0;
    for (const c of candidates) {
      if (found >= target) break;
      if (!c.domain) continue;
      const emails = await scrapeDomain(c.domain);
      if (emails.length === 0) continue;
      await admin.from("leads").insert({
        user_id: user.id,
        prospecting_job_id: jobId,
        source: "web",
        source_id: c.domain,
        primary_domain: c.domain,
        display_name: c.company,
        email: emails[0],
        email_status: "unverified",
        industry: c.industry,
        niche,
        status: "new",
        metadata: { all_emails: emails },
      });
      found++;
      await admin.from("prospecting_jobs").update({ found_count: found }).eq("id", jobId);
    }

    await admin.from("prospecting_jobs").update({ status: "done", found_count: found }).eq("id", jobId);
    return json({ ok: true, found });
  } catch (e) {
    console.error("web-prospector", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
