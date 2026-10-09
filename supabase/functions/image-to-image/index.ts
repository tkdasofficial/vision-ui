import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logUsage, userIdFromAuth } from "../_shared/provider-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Edit an image with Lovable AI (Gemini 2.5 Flash Image / Nano Banana).
// Falls through a small list of image-capable models on transient errors.
const EDIT_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

async function editWithLovableAI(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  instruction: string,
  model: string,
): Promise<{ imageUrl: string; prompt: string; model: string } | { error: string; status: number }> {
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Lovable AI image edit [${model}] error:`, response.status, errText.slice(0, 300));
    return { error: errText.slice(0, 300), status: response.status };
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const editedImage = message?.images?.[0]?.image_url?.url;
  const textResponse = message?.content || instruction;

  if (!editedImage) {
    return { error: "No image returned in response", status: 502 };
  }
  return { imageUrl: editedImage, prompt: textResponse, model };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = userIdFromAuth(req);
  try {
    const { image, mimeType, instruction, model: requestedModel } = await req.json();

    if (!image || !instruction) {
      return new Response(
        JSON.stringify({ error: "Image and instruction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const models = requestedModel && requestedModel.includes("/")
      ? [requestedModel, ...EDIT_MODELS.filter((m) => m !== requestedModel)]
      : EDIT_MODELS;

    let lastErr: { error: string; status: number } | null = null;
    for (const model of models) {
      const result = await editWithLovableAI(
        LOVABLE_API_KEY,
        image,
        mimeType || "image/png",
        instruction,
        model,
      );
      if ("imageUrl" in result) {
        logUsage({
          userId,
          functionName: "image-to-image",
          provider: "lovable-ai",
          capability: "image",
          source: "shared",
          metadata: { model: result.model },
        });
        return new Response(
          JSON.stringify({
            images: [{ url: result.imageUrl }],
            prompt: result.prompt,
            provider: "lovable-ai",
            model: result.model,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      lastErr = result;
      // Only iterate to next model on transient errors
      if (result.status !== 429 && result.status !== 500 && result.status !== 502 && result.status !== 503) {
        break;
      }
    }

    const status = lastErr?.status === 429 ? 429 : lastErr?.status === 402 ? 402 : 500;
    const message = lastErr?.status === 429
      ? "Rate limit exceeded. Please try again later."
      : lastErr?.status === 402
        ? "AI credits exhausted. Please add credits to continue."
        : `Image edit failed: ${lastErr?.error || "unknown error"}`;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-to-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
