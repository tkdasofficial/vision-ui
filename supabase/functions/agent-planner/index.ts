import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a task planner AI. Given a complex user request, break it down into sequential steps that can be executed by these tools:

AVAILABLE TOOLS:
- "chat": General AI text generation (brainstorming, writing, analysis, lists, ideas, strategies, outlines)
- "image-generator": Generate images from text prompts (thumbnails, graphics, illustrations, logos)
- "code-generator": Generate web apps, websites, games, landing pages
- "file-creator": Create downloadable files (PDF, DOCX, XLSX, TXT, CSV, JSON, MD, HTML)
- "tts": Text-to-speech / voiceover generation
- "video-generator": Create videos from topics

RULES:
1. Each step must use exactly ONE tool
2. Steps can run in PARALLEL when they don't depend on each other
3. Use "dependsOn" array to specify which step IDs must complete first
4. Steps without dependsOn (or empty array) and without {{step_N}} refs can run in parallel
5. The "prompt" field should be a complete, standalone instruction for that tool
6. Use {{step_N}} syntax to reference output from step N (e.g. "Using the ideas from {{step_1}}, write a script")
7. Maximum 10 steps
8. Provide a brief title for the overall plan

Return ONLY valid JSON in this exact format:
{
  "title": "Brief plan title",
  "steps": [
    {
      "id": 1,
      "tool": "chat",
      "label": "Short step description (max 6 words)",
      "prompt": "Complete prompt for this tool",
      "dependsOn": []
    }
  ]
}`;

function getGeminiKeys(): string[] {
  const keys: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
    if (k) keys.push(k);
  }
  return keys;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKeys = getGeminiKeys();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (geminiKeys.length === 0 && !GROQ_API_KEY) {
      throw new Error("No AI API keys configured");
    }

    let result: any = null;

    // Try Gemini
    for (const key of geminiKeys) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (r.ok) {
          const data = await r.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            result = JSON.parse(text);
            break;
          }
        }
        if (r.status !== 429 && r.status !== 503) break;
      } catch (e) {
        console.warn("Gemini error:", e);
      }
    }

    // Groq fallback
    if (!result && GROQ_API_KEY) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) result = JSON.parse(text);
      }
    }

    if (!result || !result.steps?.length) {
      throw new Error("Failed to generate plan");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
