import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──

type SceneInput = {
  index: number;
  imageUrl: string;
  narration?: string;
  duration?: number;
};

type SceneIssue = {
  sceneIndex: number;
  category: string;
  severity: "critical" | "major" | "minor";
  description: string;
  fix: string;
  autoFixable: boolean;
  fixParams?: Record<string, any>;
};

type AnalysisResult = {
  overallScore: number;
  consistencyScore: number;
  qualityScore: number;
  pacingScore: number;
  issues: SceneIssue[];
  summary: string;
  recommendations: string[];
  sceneScores: { index: number; score: number; notes: string }[];
};

// ── Convert image URL to base64 for Gemini ──

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    return { base64, mimeType: contentType.split(";")[0] };
  } catch {
    return null;
  }
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenes, aspectRatio, contentType } = await req.json() as {
      scenes: SceneInput[];
      aspectRatio?: string;
      contentType?: "short" | "long";
    };

    if (!scenes || scenes.length === 0) {
      throw new Error("No scenes provided for analysis");
    }

    // Gather all Gemini keys for fallback
    const geminiKeys: string[] = [];
    for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
      const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
      if (k) geminiKeys.push(k);
    }
    if (geminiKeys.length === 0) throw new Error("No Gemini API keys configured");

    const isLongForm = (contentType === "long") || scenes.length > 8;

    // ── Fetch all scene images ──
    const imageData: ({ base64: string; mimeType: string } | null)[] = [];
    for (const scene of scenes) {
      const img = await fetchImageAsBase64(scene.imageUrl);
      imageData.push(img);
    }

    const validImages = imageData.filter(Boolean);
    if (validImages.length === 0) {
      throw new Error("Could not load any scene images for analysis");
    }

    // ── Build Gemini vision request ──
    const systemPrompt = `You are a professional video post-production quality analyst. You analyze visual assets for video projects and evaluate consistency, quality, and professionalism.

ANALYSIS CRITERIA:

1. **Visual Consistency** (weight: 35%)
   - Color palette harmony across all scenes
   - Lighting consistency (direction, temperature, intensity)
   - Art style / aesthetic coherence
   - Subject framing and composition patterns
   - Background consistency and visual continuity

2. **Individual Quality** (weight: 35%)
   - Image resolution and sharpness
   - Composition quality (rule of thirds, leading lines, balance)
   - Color accuracy and vibrancy
   - Artifacts, noise, or generation defects
   - Professional-grade visual standard

3. **Pacing & Flow** (weight: 15%)
   - Visual rhythm between scenes
   - Scene-to-scene transition readiness
   - Energy progression (builds, peaks, resolution)
   - ${isLongForm ? "Chapter/segment visual differentiation while maintaining overall coherence" : "Hook strength in opening scenes, memorable closing"}

4. **Content-Type Standards** (weight: 15%)
   ${isLongForm
      ? `- Long-form: consistent branding elements, visual chapters, viewer retention cues
   - Segment transitions should feel intentional, not jarring
   - Color grading should maintain a unified look across the full duration
   - Background/setting changes must feel motivated by narrative`
      : `- Short-form: immediate visual impact, platform-optimized framing (${aspectRatio || "9:16"})
   - First scene must be a strong hook
   - Visual pace must be dynamic for retention
   - Each scene must deliver standalone visual interest`}

RESPONSE FORMAT (strict JSON):
{
  "overallScore": <0-100>,
  "consistencyScore": <0-100>,
  "qualityScore": <0-100>,
  "pacingScore": <0-100>,
  "issues": [
    {
      "sceneIndex": <0-based>,
      "category": "color_mismatch" | "style_inconsistency" | "low_quality" | "poor_composition" | "artifacts" | "lighting_mismatch" | "framing_issue" | "pacing_break" | "weak_hook" | "flat_visual",
      "severity": "critical" | "major" | "minor",
      "description": "Clear description of the issue",
      "fix": "Specific actionable fix instruction",
      "autoFixable": true/false,
      "fixParams": { "type": "regenerate_image" | "filter" | "color_grade" | "zoom_pan" | "adjust_timing", ...params }
    }
  ],
  "summary": "2-3 sentence professional assessment",
  "recommendations": ["Top 3-5 prioritized improvement actions"],
  "sceneScores": [
    { "index": 0, "score": <0-100>, "notes": "Brief quality note" }
  ]
}

Be precise, actionable, and professional. Score harshly — 70+ should mean genuinely broadcast-ready quality.`;

    // Build parts array with all images
    const userParts: any[] = [
      {
        text: `Analyze these ${scenes.length} scenes from a ${isLongForm ? "long-form" : "short-form"} video project (${aspectRatio || "9:16"} aspect ratio). Evaluate visual consistency, individual quality, and professional readiness.\n\nScene details:\n${scenes.map((s, i) => `Scene ${i + 1}: ${s.narration || "No narration"} (${s.duration || 5}s)`).join("\n")}`,
      },
    ];

    // Add images
    for (let i = 0; i < imageData.length; i++) {
      const img = imageData[i];
      if (img) {
        userParts.push({
          text: `\n--- Scene ${i + 1} ---`,
        });
        userParts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.base64,
          },
        });
      }
    }

    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    let res: Response | null = null;
    let lastError = "";

    for (const key of geminiKeys) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
        );
        if (r.ok) { res = r; break; }
        lastError = await r.text();
        console.warn(`Gemini key failed (${r.status}):`, lastError.slice(0, 200));
        if (r.status !== 429 && r.status !== 503 && r.status !== 500) break;
      } catch (e) { lastError = String(e); }
    }

    if (!res?.ok) {
      if (lastError.includes("429")) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`All Gemini keys failed: ${lastError.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No analysis generated");

    const analysis: AnalysisResult = JSON.parse(text);

    // Validate structure
    if (typeof analysis.overallScore !== "number") {
      throw new Error("Invalid analysis structure");
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visual-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
