import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, duration = 45, aspect_ratio = "9:16", style = "engaging" } = await req.json();

    // Gather all Gemini keys for fallback
    const geminiKeys: string[] = [];
    for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
      const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
      if (k) geminiKeys.push(k);
    }
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (geminiKeys.length === 0 && !GROQ_API_KEY) throw new Error("No AI API keys configured");

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sceneCount = Math.max(3, Math.min(12, Math.round(duration / 5)));

    const systemPrompt = `You are an expert short-form video scriptwriter and visual director. You create viral, engaging scripts for TikTok, YouTube Shorts, and Instagram Reels.

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation.

Generate a video script with exactly ${sceneCount} scenes for a ${duration}-second video. The aspect ratio is ${aspect_ratio}. Style: ${style}.

Return this exact JSON structure:
{
  "title": "Video title",
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "The exact text to be spoken by the narrator for this scene. Keep it natural and engaging.",
      "imagePrompt": "Extremely detailed image generation prompt. Include: subject, composition, lighting, color palette, mood, camera angle. Style should be photorealistic cinematic. Must be visually consistent with other scenes.",
      "duration": 5,
      "transition": "fade"
    }
  ]
}

Rules:
- Each scene narration should be 1-3 sentences, timed to fit its duration
- Image prompts must be highly detailed (50+ words each) for AI image generation
- All image prompts should maintain visual consistency (same color grading, style, quality)
- Start with a hook scene that grabs attention in the first 2 seconds
- End with a memorable closing or call-to-action
- Total duration of all scenes must equal approximately ${duration} seconds
- Transitions can be: "fade", "cut", "zoom", "slide"
- Make narration conversational and engaging for short-form content`;

    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: `Create a ${duration}-second short-form video script about: ${topic}` }] }],
      generationConfig: {
        temperature: 0.8,
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
        console.warn(`Gemini key failed (${r.status})`);
        if (r.status !== 429 && r.status !== 503 && r.status !== 500) break;
      } catch (e) { lastError = String(e); }
    }

    // Groq fallback
    if (!res?.ok && GROQ_API_KEY) {
      console.log("Falling back to Groq for video-script");
      try {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Create a ${duration}-second short-form video script about: ${topic}` },
            ],
            temperature: 0.8,
            response_format: { type: "json_object" },
          }),
        });
        if (groqResp.ok) {
          const d = await groqResp.json();
          const t = d.choices?.[0]?.message?.content;
          if (t) res = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }), { status: 200 });
        } else { lastError = await groqResp.text(); }
      } catch (e) { console.error("Groq error:", e); }
    }

    if (!res?.ok) throw new Error(`All AI providers failed: ${lastError.slice(0, 300)}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No script generated");

    let script;
    try {
      script = JSON.parse(text);
    } catch {
      // Try to extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse script JSON");
      }
    }

    // Validate structure
    if (!script.scenes || !Array.isArray(script.scenes)) {
      throw new Error("Invalid script structure");
    }

    return new Response(JSON.stringify(script), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-video-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
