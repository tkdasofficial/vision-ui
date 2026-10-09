import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractEmails } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const YT = "https://www.googleapis.com/youtube/v3";

async function getUserKey(admin: any, userId: string, provider: string): Promise<string | null> {
  const secret = Deno.env.get("USER_KEY_ENCRYPTION_SECRET");
  if (!secret) return null;
  const { data } = await admin.rpc("get_user_api_key", {
    _user_id: userId,
    _provider: provider,
    _secret: secret,
  });
  return data?.[0]?.plaintext ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { jobId } = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: job } = await admin.from("prospecting_jobs").select("*").eq("id", jobId).eq("user_id", user.id).single();
    if (!job) return json({ error: "Job not found" }, 404);

    const params = job.params || {};
    const niche: string = params.niche || "";
    const minSubs: number = params.minSubs ?? 0;
    const maxSubs: number = params.maxSubs ?? 1_000_000_000;
    const minViews: number = params.minAvgViews ?? 0;
    const maxViews: number = params.maxAvgViews ?? 1_000_000_000;
    const target: number = job.target_count || 50;

    const apiKey = (await getUserKey(admin, user.id, "youtube")) || Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      await admin.from("prospecting_jobs").update({ status: "error", error: "No YouTube API key. Add one under Integrations > API Keys (provider: youtube)." }).eq("id", jobId);
      return json({ error: "Missing YouTube API key" }, 400);
    }

    await admin.from("prospecting_jobs").update({ status: "running" }).eq("id", jobId);

    let pageToken: string | undefined;
    let found = 0;
    const seen = new Set<string>();

    outer: for (let page = 0; page < 20; page++) {
      const searchUrl = new URL(`${YT}/search`);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "channel");
      searchUrl.searchParams.set("q", niche);
      searchUrl.searchParams.set("maxResults", "50");
      searchUrl.searchParams.set("key", apiKey);
      if (pageToken) searchUrl.searchParams.set("pageToken", pageToken);
      const sRes = await fetch(searchUrl);
      if (!sRes.ok) throw new Error(`search.list ${sRes.status}: ${await sRes.text()}`);
      const sJson = await sRes.json();
      pageToken = sJson.nextPageToken;

      const channelIds: string[] = (sJson.items || [])
        .map((it: any) => it.snippet?.channelId || it.id?.channelId)
        .filter((id: string) => id && !seen.has(id));
      channelIds.forEach((id) => seen.add(id));
      if (channelIds.length === 0) { if (!pageToken) break; continue; }

      const chUrl = new URL(`${YT}/channels`);
      chUrl.searchParams.set("part", "snippet,statistics,contentDetails,brandingSettings");
      chUrl.searchParams.set("id", channelIds.join(","));
      chUrl.searchParams.set("key", apiKey);
      const cRes = await fetch(chUrl);
      if (!cRes.ok) throw new Error(`channels.list ${cRes.status}`);
      const cJson = await cRes.json();

      for (const ch of cJson.items || []) {
        const subs = Number(ch.statistics?.subscriberCount || 0);
        if (subs < minSubs || subs > maxSubs) continue;

        // Fetch last ~15 videos via uploads playlist
        const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
        if (!uploads) continue;
        const pRes = await fetch(`${YT}/playlistItems?part=contentDetails&maxResults=15&playlistId=${uploads}&key=${apiKey}`);
        if (!pRes.ok) continue;
        const pJson = await pRes.json();
        const videoIds = (pJson.items || []).map((it: any) => it.contentDetails?.videoId).filter(Boolean);
        if (videoIds.length === 0) continue;

        const vRes = await fetch(`${YT}/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${apiKey}`);
        if (!vRes.ok) continue;
        const vJson = await vRes.json();
        const views = (vJson.items || []).map((v: any) => Number(v.statistics?.viewCount || 0));
        const avg = views.length ? Math.round(views.reduce((a: number, b: number) => a + b, 0) / views.length) : 0;
        if (avg < minViews || avg > maxViews) continue;

        // Extract emails from about + recent video descriptions
        const aboutText = [
          ch.snippet?.description || "",
          ch.brandingSettings?.channel?.description || "",
          ...(vJson.items || []).map((v: any) => v.snippet?.description || ""),
        ].join("\n");
        const emails = extractEmails(aboutText);
        if (emails.length === 0) continue;

        await admin.from("leads").insert({
          user_id: user.id,
          prospecting_job_id: jobId,
          source: "youtube",
          source_id: ch.id,
          channel_url: `https://youtube.com/channel/${ch.id}`,
          display_name: ch.snippet?.title || null,
          email: emails[0],
          email_status: "unverified",
          subscriber_count: subs,
          avg_views: avg,
          niche,
          status: "new",
          metadata: { all_emails: emails, thumbnail: ch.snippet?.thumbnails?.default?.url, country: ch.snippet?.country },
        });
        found++;
        await admin.from("prospecting_jobs").update({ found_count: found }).eq("id", jobId);
        if (found >= target) break outer;
      }
      if (!pageToken) break;
    }

    await admin.from("prospecting_jobs").update({ status: "done", found_count: found }).eq("id", jobId);
    return json({ ok: true, found });
  } catch (e) {
    console.error("youtube-prospector", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
