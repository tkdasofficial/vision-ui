import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateProviderKey, CAPABILITY_PROVIDERS } from "../_shared/provider-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PROVIDERS = new Set(
  Object.values(CAPABILITY_PROVIDERS).flat(),
);

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data } = await userClient.auth.getUser();
  return data.user ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = adminClient();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "GET" ? "list" : "");

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("user_api_keys")
        .select("id, provider, label, key_hint, metadata, status, last_validated_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Response.json({ keys: data ?? [] }, { headers: corsHeaders });
    }

    if (action === "add") {
      const { provider, label, key, metadata } = await req.json();
      if (!provider || !key) {
        return Response.json({ error: "provider and key required" }, { status: 400, headers: corsHeaders });
      }
      if (!ALLOWED_PROVIDERS.has(provider)) {
        return Response.json({ error: `Unsupported provider: ${provider}` }, { status: 400, headers: corsHeaders });
      }
      // Plan gate
      const { data: allowed } = await admin.rpc("can_use_own_keys", { _user_id: user.id });
      if (!allowed) {
        return Response.json(
          { error: "Connecting your own API keys requires a Basic, Pro, or Business plan." },
          { status: 403, headers: corsHeaders },
        );
      }
      // Validate
      const v = await validateProviderKey(provider, key);
      if (!v.ok) {
        return Response.json({ error: `Invalid key: ${v.error}` }, { status: 400, headers: corsHeaders });
      }
      const secret = Deno.env.get("USER_KEY_ENCRYPTION_SECRET");
      if (!secret) throw new Error("Server encryption not configured");

      const { data: id, error } = await admin.rpc("store_user_api_key", {
        _user_id: user.id,
        _provider: provider,
        _label: label || "default",
        _plaintext: key,
        _secret: secret,
        _metadata: metadata || {},
      });
      if (error) throw error;
      return Response.json({ id, ok: true }, { headers: corsHeaders });
    }

    if (action === "remove") {
      const { id } = await req.json();
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
      const { error } = await admin
        .from("user_api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "validate") {
      const { id } = await req.json();
      const secret = Deno.env.get("USER_KEY_ENCRYPTION_SECRET");
      if (!secret) throw new Error("Server encryption not configured");
      const { data: row } = await admin
        .from("user_api_keys")
        .select("provider")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      const { data: kdata } = await admin.rpc("get_user_api_key", {
        _user_id: user.id,
        _provider: row.provider,
        _secret: secret,
      });
      if (!kdata || kdata.length === 0) {
        return Response.json({ error: "Key not retrievable" }, { status: 404, headers: corsHeaders });
      }
      const v = await validateProviderKey(row.provider, kdata[0].plaintext);
      await admin
        .from("user_api_keys")
        .update({ status: v.ok ? "active" : "invalid", last_validated_at: new Date().toISOString() })
        .eq("id", id);
      return Response.json({ ok: v.ok, error: v.error }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("user-keys error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500, headers: corsHeaders },
    );
  }
});
