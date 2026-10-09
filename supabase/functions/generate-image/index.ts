import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logUsage, userIdFromAuth } from "../_shared/provider-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map aspect_ratio → size accepted by gpt-image-2
const SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "3:2": "1536x1024",
  "4:3": "1536x1024",
  "9:16": "1024x1536",
  "2:3": "1024x1536",
  "3:4": "1024x1536",
  "2:1": "1536x1024",
  "1:2": "1024x1536",
  "4:5": "1024x1536",
};

async function enhancePrompt(userPrompt: string, apiKey: string): Promise<string> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are an expert image prompt engineer. Rewrite the user's image request as a single highly detailed prompt (subject, composition, lighting, palette, style, mood, camera, quality). Output ONLY the prompt text, max 200 words.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) return userPrompt;
    const data = await r.json();
    return data.choices?.[0]?.message?.content?.trim() || userPrompt;
  } catch {
    return userPrompt;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = userIdFromAuth(req);
  try {
    const { prompt, aspect_ratio = "1:1", num_images = 1, model: requestedModel } =
      await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const enhanced = await enhancePrompt(prompt, LOVABLE_API_KEY);
    const size = SIZE_BY_RATIO[aspect_ratio] || "1024x1024";

    // Choose model: legacy "flux"/"mystic"/"flux-pro" map to gpt-image-2 default.
    // Allow direct passthrough of explicit Lovable AI image model names.
    const model =
      requestedModel && requestedModel.includes("/")
        ? requestedModel
        : "openai/gpt-image-2";

    const n = Math.min(Math.max(Number(num_images) || 1, 1), 4);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: enhanced,
        size,
        quality: "low",
        n,
        // non-streaming: simpler client integration; UI shows spinner
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Lovable AI image error:", resp.status, errText.slice(0, 500));
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Image generation failed [${resp.status}]`, details: errText.slice(0, 300) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    const images = items
      .map((it) => {
        if (it?.b64_json) return { url: `data:image/png;base64,${it.b64_json}`, base64: it.b64_json };
        if (it?.url) return { url: it.url };
        return null;
      })
      .filter(Boolean);

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ error: "No image returned from provider" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    logUsage({
      userId,
      functionName: "generate-image",
      provider: "lovable-ai",
      capability: "image",
      source: "shared",
      metadata: { model, num: images.length },
    });

    return new Response(
      JSON.stringify({ images, prompt: enhanced, provider: "lovable-ai", model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
