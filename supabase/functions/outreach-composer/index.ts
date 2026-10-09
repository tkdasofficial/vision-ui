import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function generatePersonalizedEmail(lead: any, campaign: any, lovableKey: string) {
  const isYT = lead.source === "youtube";
  const context = isYT
    ? `YouTube channel "${lead.display_name}" in the ${lead.niche || "content creation"} niche, ${lead.subscriber_count?.toLocaleString?.() || "?"} subscribers, averaging ${lead.avg_views?.toLocaleString?.() || "?"} views on recent uploads.`
    : `Company "${lead.display_name}" (${lead.primary_domain}) in the ${lead.industry || lead.niche || "target"} space.`;

  const systemPrompt = `You are an elite cold-outreach copywriter for a freelancer. Write ONE email that reads like a hand-written note from a real person — not marketing copy.

Rules:
- Subject line: 4-7 words. Reference the recipient specifically. NO clickbait, no ALL CAPS, no emojis.
- Body: 70-110 words. Plain text only. No markdown, no bullet points.
- Open with a specific observation about the recipient (${isYT ? "their content/views" : "their industry/company"}). Show you actually looked.
- State a precise, high-value motive tailored to them.
- End with a soft, single-question CTA. Sign off with the freelancer's first name only.
- No "I hope this finds you well", no "I stumbled upon", no cliches.

Return ONLY a JSON object: {"subject": "...", "body": "..."}`;

  const userPrompt = `Recipient: ${context}
Recent-video/company signal: ${isYT ? `avg ${lead.avg_views} views on recent uploads` : `industry: ${lead.industry}`}
Freelancer's pitch/offer: ${campaign.pitch_context}
Tone: ${campaign.tone || "friendly-professional"}
Compose the email now.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Compose failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);
  return { subject: String(parsed.subject || "").slice(0, 200), body: String(parsed.body || "") };
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

    const { leadIds, campaignId } = await req.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0) return json({ error: "leadIds required" }, 400);
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: campaign } = await admin.from("outreach_campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).single();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: leads } = await admin.from("leads").select("*").eq("user_id", user.id).in("id", leadIds);
    if (!leads?.length) return json({ error: "No leads" }, 404);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    // Compute schedule: cumulative jitter between throttle_min and throttle_max
    const { data: lastQueued } = await admin
      .from("email_queue").select("scheduled_at").eq("user_id", user.id).eq("status", "queued")
      .order("scheduled_at", { ascending: false }).limit(1).maybeSingle();
    let cursor = lastQueued ? new Date(lastQueued.scheduled_at).getTime() : Date.now();

    let queued = 0;
    for (const lead of leads) {
      if (!lead.email) continue;
      try {
        await admin.from("leads").update({ status: "processing" }).eq("id", lead.id);
        const { subject, body } = await generatePersonalizedEmail(lead, campaign, lovableKey);
        const delay = (campaign.throttle_min_sec + Math.random() * (campaign.throttle_max_sec - campaign.throttle_min_sec)) * 1000;
        cursor = Math.max(cursor, Date.now()) + delay;
        await admin.from("email_queue").insert({
          user_id: user.id,
          lead_id: lead.id,
          campaign_id: campaignId,
          subject,
          body,
          scheduled_at: new Date(cursor).toISOString(),
          status: "queued",
          step: 0,
        });
        await admin.from("leads").update({ status: "queued" }).eq("id", lead.id);
        queued++;
      } catch (e) {
        console.error("compose fail lead", lead.id, e);
        await admin.from("leads").update({ status: "error", email_status: String((e as Error).message ?? e).slice(0, 200) }).eq("id", lead.id);
      }
    }
    return json({ ok: true, queued });
  } catch (e) {
    console.error("outreach-composer", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
