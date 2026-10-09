import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

type ProviderCfg = {
  authUrl: string;
  scope: string;
  clientIdEnv: string;
  extra?: Record<string, string>;
};

const PROVIDERS: Record<string, ProviderCfg> = {
  gmail: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    extra: { access_type: "offline", prompt: "consent" },
  },
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.email",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    extra: { access_type: "offline", prompt: "consent" },
  },
  google_drive: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    extra: { access_type: "offline", prompt: "consent" },
  },
  google_calendar: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    extra: { access_type: "offline", prompt: "consent" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { provider } = await req.json();
    const cfg = PROVIDERS[provider];
    if (!cfg) return json({ error: "Unknown provider" }, 400);

    const clientId = Deno.env.get(cfg.clientIdEnv);
    if (!clientId) {
      return json({ error: `Missing ${cfg.clientIdEnv}. Add this provider's OAuth Client ID in Supabase secrets.` }, 400);
    }

    const state = crypto.randomUUID();
    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from("oauth_states").insert({ state, user_id: user.id, provider });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      state,
      ...(cfg.scope ? { scope: cfg.scope } : {}),
      ...(cfg.extra ?? {}),
    });

    return json({ authUrl: `${cfg.authUrl}?${params.toString()}` });
  } catch (e) {
    console.error("oauth-initiate error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
