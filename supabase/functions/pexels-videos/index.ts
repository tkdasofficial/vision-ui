import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getProviderKey, logUsage, userIdFromAuth } from "../_shared/provider-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userId = userIdFromAuth(req);
  try {
    const { key: PEXELS_API_KEY, source } = await getProviderKey(userId, "pexels");
    if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not configured");


    const { query, per_page = 6, page = 1, orientation, size } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      query,
      per_page: String(per_page),
      page: String(page),
    });
    if (orientation) params.set("orientation", orientation);
    if (size) params.set("size", size);

    const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pexels API error [${res.status}]: ${errText}`);
    }

    const data = await res.json();

    // Normalize response
    const videos = (data.videos || []).map((v: any) => {
      const hdFile = v.video_files?.find((f: any) => f.quality === "hd") || v.video_files?.[0];
      const sdFile = v.video_files?.find((f: any) => f.quality === "sd");
      return {
        id: v.id,
        url: v.url,
        image: v.image, // thumbnail
        duration: v.duration,
        width: v.width,
        height: v.height,
        user: { name: v.user?.name, url: v.user?.url },
        videoUrl: hdFile?.link || sdFile?.link,
        previewUrl: sdFile?.link || hdFile?.link,
      };
    });

    logUsage({ userId, functionName: "pexels-videos", provider: "pexels", capability: "stock-video", source, metadata: { query, count: videos.length } });
    return new Response(
      JSON.stringify({ videos, total_results: data.total_results, page: data.page, per_page: data.per_page, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("pexels-videos error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
