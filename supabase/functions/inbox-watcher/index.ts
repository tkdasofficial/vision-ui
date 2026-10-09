// Monitors connected Gmail inboxes: detects replies to tracked threads and bounce notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getGmailAuth } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function processUser(admin: any, userId: string) {
  const auth = await getGmailAuth(userId);
  if (!auth) return { skipped: true };

  // Fetch recent inbox messages
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox+newer_than:1d&maxResults=50`,
    { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  );
  if (!listRes.ok) return { error: `list ${listRes.status}` };
  const listJson = await listRes.json();
  const ids: string[] = (listJson.messages || []).map((m: any) => m.id);

  let replied = 0, bounced = 0;
  for (const id of ids) {
    const mRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=Subject&metadataHeaders=X-Failed-Recipients`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    );
    if (!mRes.ok) continue;
    const m = await mRes.json();
    const headers = Object.fromEntries((m.payload?.headers || []).map((h: any) => [h.name.toLowerCase(), h.value]));
    const threadId = m.threadId;
    const from = (headers["from"] || "").toLowerCase();
    const inReplyTo = headers["in-reply-to"];
    const failedRcpts = headers["x-failed-recipients"];
    const subject = headers["subject"] || "";

    // Bounce detection
    if (from.includes("mailer-daemon") || from.includes("postmaster") || failedRcpts || /delivery.*failed|undelivered/i.test(subject)) {
      const bounceEmail = (failedRcpts || (subject.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]) || "").toLowerCase();
      if (bounceEmail) {
        const { data: leads } = await admin.from("leads").select("id").eq("user_id", userId).eq("email", bounceEmail);
        for (const l of leads || []) {
          await admin.from("leads").update({ status: "bounced", email_status: "bounced" }).eq("id", l.id);
          await admin.from("email_queue").update({ status: "cancelled", last_error: "bounced" }).eq("lead_id", l.id).eq("status", "queued");
          bounced++;
        }
      }
      continue;
    }

    // Reply detection — match thread we sent
    const { data: sent } = await admin.from("email_queue")
      .select("id, lead_id")
      .eq("user_id", userId)
      .eq("gmail_thread_id", threadId)
      .eq("status", "sent")
      .limit(1);
    if (sent && sent.length) {
      const leadId = sent[0].lead_id;
      await admin.from("leads").update({ status: "replied" }).eq("id", leadId);
      // Freeze any queued follow-ups
      await admin.from("email_queue").update({ status: "cancelled", last_error: "reply-received" })
        .eq("lead_id", leadId).eq("status", "queued");
      replied++;
    }
  }
  return { replied, bounced };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    // Only users with a connected gmail
    const { data: users } = await admin.from("user_integrations").select("user_id").eq("provider", "gmail").eq("status", "connected");
    const uniq = [...new Set((users || []).map((u: any) => u.user_id))];
    const results: any[] = [];
    for (const uid of uniq) {
      try { results.push({ uid, ...(await processUser(admin, uid)) }); }
      catch (e) { results.push({ uid, error: String((e as Error).message ?? e) }); }
    }
    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
