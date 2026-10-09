import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

type ProviderCfg = {
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  userInfoUrl?: string;
  userInfoLabelKey?: string;
  tokenAuthInHeader?: boolean; // Slack-style? no, we use body
  extraTokenParams?: Record<string, string>;
};

const PROVIDERS: Record<string, ProviderCfg> = {
  gmail: { tokenUrl: "https://oauth2.googleapis.com/token", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET", userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo", userInfoLabelKey: "email" },
  youtube: { tokenUrl: "https://oauth2.googleapis.com/token", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET", userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo", userInfoLabelKey: "email" },
  google_drive: { tokenUrl: "https://oauth2.googleapis.com/token", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET", userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo", userInfoLabelKey: "email" },
  google_calendar: { tokenUrl: "https://oauth2.googleapis.com/token", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET", userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo", userInfoLabelKey: "email" },
  outlook: { tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", clientIdEnv: "MICROSOFT_CLIENT_ID", clientSecretEnv: "MICROSOFT_CLIENT_SECRET", userInfoUrl: "https://graph.microsoft.com/v1.0/me", userInfoLabelKey: "userPrincipalName" },
  github: { tokenUrl: "https://github.com/login/oauth/access_token", clientIdEnv: "GITHUB_OAUTH_CLIENT_ID", clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET", userInfoUrl: "https://api.github.com/user", userInfoLabelKey: "login" },
  slack: { tokenUrl: "https://slack.com/api/oauth.v2.access", clientIdEnv: "SLACK_CLIENT_ID", clientSecretEnv: "SLACK_CLIENT_SECRET" },
  discord: { tokenUrl: "https://discord.com/api/oauth2/token", clientIdEnv: "DISCORD_CLIENT_ID", clientSecretEnv: "DISCORD_CLIENT_SECRET", userInfoUrl: "https://discord.com/api/users/@me", userInfoLabelKey: "username" },
  notion: { tokenUrl: "https://api.notion.com/v1/oauth/token", clientIdEnv: "NOTION_CLIENT_ID", clientSecretEnv: "NOTION_CLIENT_SECRET" },
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) return html(renderResult(false, errParam));
  if (!code || !state) return html(renderResult(false, "Missing code or state"));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: st, error: stErr } = await admin.from("oauth_states").select("*").eq("state", state).maybeSingle();
    if (stErr || !st) return html(renderResult(false, "Invalid or expired state"));
    await admin.from("oauth_states").delete().eq("state", state);
    if (new Date(st.expires_at).getTime() < Date.now()) return html(renderResult(false, "State expired"));

    const cfg = PROVIDERS[st.provider];
    if (!cfg) return html(renderResult(false, "Unknown provider"));

    const clientId = Deno.env.get(cfg.clientIdEnv);
    const clientSecret = Deno.env.get(cfg.clientSecretEnv);
    if (!clientId || !clientSecret) return html(renderResult(false, `Missing ${cfg.clientIdEnv}/${cfg.clientSecretEnv}`));

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      ...(cfg.extraTokenParams ?? {}),
    });

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      console.error("token exchange failed", tokenJson);
      return html(renderResult(false, tokenJson.error_description || tokenJson.error || "Token exchange failed"));
    }

    const accessToken = tokenJson.access_token || tokenJson.authed_user?.access_token;
    const refreshToken = tokenJson.refresh_token ?? null;
    const expiresIn = tokenJson.expires_in ?? null;
    const scopes = tokenJson.scope ?? null;
    const expiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString() : null;

    let label: string | null = null;
    if (cfg.userInfoUrl && accessToken) {
      try {
        const infoRes = await fetch(cfg.userInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "SuperCopilot", "Notion-Version": "2022-06-28" },
        });
        if (infoRes.ok) {
          const info: any = await infoRes.json();
          label = info[cfg.userInfoLabelKey ?? "email"] ?? null;
        }
      } catch (_) { /* ignore */ }
    }
    if (!label) {
      if (st.provider === "slack") label = tokenJson.team?.name ?? "Slack workspace";
      else if (st.provider === "notion") label = tokenJson.workspace_name ?? "Notion workspace";
    }

    await admin.from("user_integrations").upsert({
      user_id: st.user_id,
      provider: st.provider,
      status: "connected",
      account_label: label,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes,
      metadata: tokenJson.team ? { team: tokenJson.team } : {},
    }, { onConflict: "user_id,provider" });

    return html(renderResult(true, st.provider));
  } catch (e) {
    console.error("oauth-callback error", e);
    return html(renderResult(false, String((e as any)?.message ?? e)));
  }
});

function html(body: string) {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function renderResult(ok: boolean, msg: string) {
  return `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0a;color:#fff;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;padding:24px">
  <div style="font-size:48px">${ok ? "✓" : "✗"}</div>
  <h2 style="margin:8px 0">${ok ? "Connected" : "Connection failed"}</h2>
  <p style="opacity:.7;font-size:13px;max-width:340px">${escapeHtml(msg)}</p>
  <p style="opacity:.5;font-size:12px;margin-top:16px">This window will close automatically.</p>
</div>
<script>
  try { window.opener && window.opener.postMessage({ type: "oauth-result", ok: ${ok}, provider: ${JSON.stringify(msg)} }, "*"); } catch(e){}
  setTimeout(()=>window.close(), 1200);
</script>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
