// Resolves which provider key to use for a given capability + user.
// If the user is on a paid plan and has connected an API key for a provider
// that satisfies the capability, return their key; otherwise fall back to the
// shared platform key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Capability = "llm" | "image" | "video" | "audio" | "stock-image" | "stock-video";

// Which providers satisfy which capability, in priority order.
export const CAPABILITY_PROVIDERS: Record<Capability, string[]> = {
  llm: ["openai", "anthropic", "gemini", "groq", "grok"],
  image: ["lovable", "openai", "gemini", "stability", "replicate"],
  video: ["runway", "luma", "replicate"],
  audio: ["elevenlabs", "openai", "google_tts"],
  "stock-image": ["pexels", "pixabay"],
  "stock-video": ["pexels", "pixabay"],
};

export interface ResolvedProvider {
  source: "user" | "shared";
  provider: string;
  apiKey: string;
  metadata?: Record<string, unknown>;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const SHARED_KEY_ENV: Record<string, string | string[]> = {
  gemini: ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"],
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  grok: "GROK_API_KEY",
  lovable: "LOVABLE_API_KEY",
  stability: "STABILITY_API_KEY",
  replicate: "REPLICATE_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  google_tts: "GOOGLE_TTS_API_KEY",
  pexels: "PEXELS_API_KEY",
  pixabay: "PIXABAY_API_KEY",
  runway: "RUNWAY_API_KEY",
  luma: "LUMA_API_KEY",
};

function getShared(provider: string): string | null {
  const env = SHARED_KEY_ENV[provider];
  if (!env) return null;
  const list = Array.isArray(env) ? env : [env];
  for (const name of list) {
    const v = Deno.env.get(name);
    if (v) return v;
  }
  return null;
}

export async function resolveProvider(
  userId: string | null,
  capability: Capability,
  preferred?: string,
): Promise<ResolvedProvider | null> {
  const order = preferred
    ? [preferred, ...CAPABILITY_PROVIDERS[capability].filter((p) => p !== preferred)]
    : CAPABILITY_PROVIDERS[capability];

  const secret = Deno.env.get("USER_KEY_ENCRYPTION_SECRET");

  if (userId && secret) {
    const supabase = adminClient();
    const { data: allowed } = await supabase.rpc("can_use_own_keys", { _user_id: userId });
    if (allowed) {
      for (const provider of order) {
        const { data, error } = await supabase.rpc("get_user_api_key", {
          _user_id: userId,
          _provider: provider,
          _secret: secret,
        });
        if (!error && data && data.length > 0 && data[0].plaintext) {
          return {
            source: "user",
            provider,
            apiKey: data[0].plaintext,
            metadata: data[0].metadata ?? {},
          };
        }
      }
    }
  }

  // Fallback to shared
  for (const provider of order) {
    const key = getShared(provider);
    if (key) return { source: "shared", provider, apiKey: key };
  }
  return null;
}

// Validates an API key by hitting a cheap endpoint on the provider.
export async function validateProviderKey(
  provider: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (provider) {
      case "openai": {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `OpenAI ${r.status}` };
      }
      case "anthropic": {
        const r = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Anthropic ${r.status}` };
      }
      case "gemini": {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        return r.ok ? { ok: true } : { ok: false, error: `Gemini ${r.status}` };
      }
      case "groq": {
        const r = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Groq ${r.status}` };
      }
      case "grok": {
        const r = await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Grok ${r.status}` };
      }
      case "lovable": {
        // Lovable AI gateway accepts the platform LOVABLE_API_KEY only; no per-user validation needed.
        return { ok: true };
      }
      case "stability": {
        const r = await fetch("https://api.stability.ai/v1/user/account", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Stability ${r.status}` };
      }
      case "replicate": {
        const r = await fetch("https://api.replicate.com/v1/account", {
          headers: { Authorization: `Token ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Replicate ${r.status}` };
      }
      case "elevenlabs": {
        const r = await fetch("https://api.elevenlabs.io/v1/user", {
          headers: { "xi-api-key": apiKey },
        });
        return r.ok ? { ok: true } : { ok: false, error: `ElevenLabs ${r.status}` };
      }
      case "google_tts": {
        const r = await fetch(
          `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`,
        );
        return r.ok ? { ok: true } : { ok: false, error: `Google TTS ${r.status}` };
      }
      case "pexels": {
        const r = await fetch("https://api.pexels.com/v1/search?query=test&per_page=1", {
          headers: { Authorization: apiKey },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Pexels ${r.status}` };
      }
      case "pixabay": {
        const r = await fetch(`https://pixabay.com/api/?key=${apiKey}&q=test&per_page=3`);
        return r.ok ? { ok: true } : { ok: false, error: `Pixabay ${r.status}` };
      }
      case "runway": {
        const r = await fetch("https://api.dev.runwayml.com/v1/organization", {
          headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Runway ${r.status}` };
      }
      case "luma": {
        const r = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return r.ok ? { ok: true } : { ok: false, error: `Luma ${r.status}` };
      }
      default:
        return { ok: true }; // Unknown provider — accept optimistically
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Validation failed" };
  }
}

// ── Convenience helpers for direct-provider functions ──
// Returns user's own key for the provider when on a paid plan, else shared.
export async function getProviderKey(
  userId: string | null,
  provider: string,
): Promise<{ key: string | null; source: "user" | "shared" | "none" }> {
  const secret = Deno.env.get("USER_KEY_ENCRYPTION_SECRET");
  if (userId && secret) {
    const supabase = adminClient();
    const { data: allowed } = await supabase.rpc("can_use_own_keys", { _user_id: userId });
    if (allowed) {
      const { data } = await supabase.rpc("get_user_api_key", {
        _user_id: userId, _provider: provider, _secret: secret,
      });
      if (data && data.length > 0 && data[0].plaintext) {
        return { key: data[0].plaintext, source: "user" };
      }
    }
  }
  const shared = getShared(provider);
  return shared ? { key: shared, source: "shared" } : { key: null, source: "none" };
}

// Fire-and-forget usage logger.
export async function logUsage(opts: {
  userId: string | null;
  functionName: string;
  provider?: string;
  capability?: string;
  source?: "user" | "shared" | "none";
  status?: "ok" | "error";
  tokens?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = adminClient();
    await supabase.from("ai_usage_logs").insert({
      user_id: opts.userId,
      function_name: opts.functionName,
      provider: opts.provider ?? null,
      capability: opts.capability ?? null,
      source: opts.source ?? null,
      status: opts.status ?? "ok",
      tokens: opts.tokens ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (_) { /* swallow */ }
}

// Extract user id from JWT in Authorization header (best-effort).
export function userIdFromAuth(req: Request): string | null {
  try {
    const h = req.headers.get("Authorization") || "";
    const token = h.replace(/^Bearer\s+/i, "");
    if (!token || token.split(".").length !== 3) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch { return null; }
}
