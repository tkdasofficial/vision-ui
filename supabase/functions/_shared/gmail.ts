// Shared Gmail helpers for user-OAuth send + inbox reads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type GmailAuth = {
  integrationId: string;
  userId: string;
  accessToken: string;
  emailAddress?: string;
};

export async function getGmailAuth(userId: string): Promise<GmailAuth | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data } = await admin
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("status", "connected")
    .maybeSingle();
  if (!data) return null;

  let token = data.access_token as string | null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (!token || expiresAt - Date.now() < 60_000) {
    // Refresh
    if (!data.refresh_token) return null;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    token = j.access_token;
    const newExpires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
    await admin.from("user_integrations").update({ access_token: token, expires_at: newExpires }).eq("id", data.id);
  }
  return {
    integrationId: data.id,
    userId,
    accessToken: token!,
    emailAddress: (data.metadata as any)?.email,
  };
}

export function encodeRfc2822(to: string, from: string, subject: string, body: string, inReplyTo?: string): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }
  lines.push("", body);
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(auth: GmailAuth, to: string, subject: string, body: string, threadId?: string) {
  const from = auth.emailAddress || "me";
  const raw = encodeRfc2822(to, from, subject, body);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed [${res.status}]: ${t}`);
  }
  return res.json() as Promise<{ id: string; threadId: string }>;
}

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  const bad = /(noreply|no-reply|donotreply|sentry|wixpress|example\.com|godaddy|@2x|@3x)/i;
  return [...new Set(matches.map((m) => m.toLowerCase()).filter((m) => !bad.test(m)))];
}
