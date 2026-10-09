// Dispatches queued emails whose scheduled_at is past due. Invoked by pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getGmailAuth, sendGmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Pick up to 25 due queued emails
    const nowIso = new Date().toISOString();
    const { data: due } = await admin
      .from("email_queue")
      .select("*, leads(email, id)")
      .eq("status", "queued")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(25);

    if (!due || due.length === 0) return json({ ok: true, sent: 0 });

    let sent = 0;
    for (const row of due) {
      const to = (row as any).leads?.email;
      if (!to) {
        await admin.from("email_queue").update({ status: "error", last_error: "No recipient email" }).eq("id", row.id);
        await admin.from("leads").update({ status: "error", email_status: "No recipient email" }).eq("id", row.lead_id);
        continue;
      }
      const auth = await getGmailAuth(row.user_id);
      if (!auth) {
        await admin.from("email_queue").update({ status: "error", last_error: "Gmail not connected" }).eq("id", row.id);
        await admin.from("leads").update({ status: "error", email_status: "Gmail not connected" }).eq("id", row.lead_id);
        continue;
      }
      // Mark as sending BEFORE the network call
      await admin.from("email_queue").update({ status: "sending" }).eq("id", row.id);
      await admin.from("leads").update({ status: "sending" }).eq("id", row.lead_id);
      try {
        const result = await sendGmail(auth, to, row.subject, row.body);
        await admin.from("email_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          gmail_message_id: result.id,
          gmail_thread_id: result.threadId,
          sender_integration_id: auth.integrationId,
        }).eq("id", row.id);
        await admin.from("leads").update({ status: "sent", email_status: "delivered" }).eq("id", row.lead_id);
        sent++;
      } catch (e) {
        console.error("dispatch fail", row.id, e);
        const msg = String((e as Error).message ?? e);
        await admin.from("email_queue").update({
          status: "error",
          last_error: msg,
          attempts: (row.attempts || 0) + 1,
        }).eq("id", row.id);
        await admin.from("leads").update({ status: "error", email_status: msg.slice(0, 200) }).eq("id", row.lead_id);
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("outreach-dispatcher", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
