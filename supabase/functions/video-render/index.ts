import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Size mappings for Lovable AI image generation ──
const SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "1024x1024", "4:3": "1536x1024", "3:4": "1024x1536",
  "16:9": "1536x1024", "9:16": "1024x1536", "3:2": "1536x1024",
  "2:3": "1024x1536", "2:1": "1536x1024", "1:2": "1024x1536", "4:5": "1024x1536",
};

// ── Gather all Gemini keys for fallback ──
function getGeminiKeys(): string[] {
  const keys: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
    if (k) keys.push(k);
  }
  return keys;
}

// ── Call Gemini with key fallback (non-streaming) ──
async function callGemini(body: any): Promise<any> {
  const keys = getGeminiKeys();
  let lastError = "";
  for (const key of keys) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (r.ok) return await r.json();
      lastError = await r.text();
      console.warn(`Gemini key failed (${r.status}):`, lastError.slice(0, 200));
      if (r.status !== 429 && r.status !== 503 && r.status !== 500) break;
    } catch (e) { lastError = String(e); }
  }
  throw new Error(`All Gemini keys failed: ${lastError.slice(0, 300)}`);
}

// ── Generate script via Gemini ──
async function generateScript(
  topic: string, duration: number, aspectRatio: string, style: string
): Promise<any> {
  const sceneCount = Math.max(3, Math.min(12, Math.round(duration / 5)));
  const systemPrompt = `You are an expert short-form video scriptwriter. Return ONLY valid JSON.
Generate a script with exactly ${sceneCount} scenes for a ${duration}-second video (${aspectRatio}, style: ${style}).
Return: {"title":"...","scenes":[{"sceneNumber":1,"narration":"...","imagePrompt":"Detailed 50+ word photorealistic prompt...","duration":5,"transition":"fade"}]}
Rules: natural narration, detailed image prompts with visual consistency, hook opening, memorable close. Transitions: fade/cut/zoom/slide.`;

  const data = await callGemini({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: `Create a ${duration}s video about: ${topic}` }] }],
    generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
  });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No script generated");
  const parsed = JSON.parse(text);
  if (!parsed.scenes?.length) throw new Error("Invalid script structure");
  return parsed;
}

// ── Generate TTS via Google Cloud TTS ──
async function generateTTS(ttsKey: string, text: string): Promise<string> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: "en-US-Neural2-D" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.05, sampleRateHertz: 24000 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS error [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.audioContent; // base64 MP3
}

// ── Enhance prompt via Gemini (with fallback) ──
async function enhancePrompt(prompt: string): Promise<string> {
  try {
    const data = await callGemini({
      system_instruction: { parts: [{ text: "Enhance this image prompt for AI generation. Include subject, composition, lighting, color, mood, camera angle. Output ONLY the enhanced text under 200 words." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
  } catch { return prompt; }
}

// ── Generate image via Lovable AI ──
async function generateImage(lovableKey: string, prompt: string, aspectRatio: string): Promise<string> {
  const enhanced = await enhancePrompt(prompt);
  const size = SIZE_BY_RATIO[aspectRatio] || "1024x1024";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: enhanced,
      size,
      quality: "low",
      n: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lovable AI image error [${res.status}]: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const first = data?.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error("No image returned");
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, topic, duration = 45, aspect_ratio = "9:16", style = "cinematic", editOps, projectState } = await req.json();

    const TTS_KEY = Deno.env.get("GOOGLE_TTS_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (getGeminiKeys().length === 0) throw new Error("No Gemini API keys configured");
    if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── STREAM progress via SSE ──
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (type: string, data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
    };

    (async () => {
      try {
        if (action === "generate") {
          // ── Full generation pipeline ──
          await sendEvent("task_update", { id: "script", status: "working", label: "Write Script" });

          const script = await generateScript(topic, duration, aspect_ratio, style);

          await sendEvent("task_update", { id: "script", status: "done", label: "Write Script", detail: `${script.scenes.length} scenes` });
          await sendEvent("script_ready", { script });

          // Announce all scene tasks
          for (let i = 0; i < script.scenes.length; i++) {
            await sendEvent("task_update", { id: `img-${i}`, status: "pending", label: `Scene ${i + 1} Image`, group: "image" });
            await sendEvent("task_update", { id: `tts-${i}`, status: "pending", label: `Scene ${i + 1} Voice`, group: "voice" });
          }

          // Generate assets — process scenes sequentially to stay within limits
          const scenes: any[] = [];
          for (let i = 0; i < script.scenes.length; i++) {
            const scene = script.scenes[i];

            // Image
            await sendEvent("task_update", { id: `img-${i}`, status: "working" });
            let imageUrl: string;
            try {
              imageUrl = await generateImage(LOVABLE_KEY, scene.imagePrompt, aspect_ratio);
              await sendEvent("task_update", { id: `img-${i}`, status: "done", detail: "Ready" });
            } catch (e: any) {
              await sendEvent("task_update", { id: `img-${i}`, status: "error", detail: e.message });
              throw e;
            }

            // TTS
            await sendEvent("task_update", { id: `tts-${i}`, status: "working" });
            let audioBase64 = "";
            if (TTS_KEY) {
              try {
                audioBase64 = await generateTTS(TTS_KEY, scene.narration);
                await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "Ready" });
              } catch (e: any) {
                await sendEvent("task_update", { id: `tts-${i}`, status: "error", detail: e.message });
                // Continue without audio — not fatal
                await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "Skipped (TTS unavailable)" });
              }
            } else {
              await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "No TTS key" });
            }

            scenes.push({
              sceneNumber: scene.sceneNumber,
              narration: scene.narration,
              imagePrompt: scene.imagePrompt,
              duration: scene.duration,
              transition: scene.transition || "fade",
              imageUrl,
              audioBase64,
              filters: [],
              textOverlays: [],
              speed: 1.0,
            });

            await sendEvent("scene_ready", { index: i, scene: scenes[i] });
          }

          // ── Visual consistency analysis ──
          await sendEvent("task_update", { id: "analysis", status: "working", label: "Quality Analysis", group: "render" });

          try {
            const analysisScenes = scenes.map((s: any, i: number) => ({
              index: i,
              imageUrl: s.imageUrl,
              narration: s.narration,
              duration: s.duration,
            }));

            const analysisResp = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/visual-analysis`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  scenes: analysisScenes,
                  aspectRatio: aspect_ratio,
                  contentType: scenes.length > 8 ? "long" : "short",
                }),
              }
            );

            if (analysisResp.ok) {
              const analysis = await analysisResp.json();
              await sendEvent("task_update", {
                id: "analysis",
                status: "done",
                label: "Quality Analysis",
                detail: `Score: ${analysis.overallScore}/100`,
              });
              await sendEvent("visual_analysis", { analysis });

              // Auto-fix critical issues by regenerating problematic scenes
              const criticalIssues = (analysis.issues || []).filter(
                (issue: any) => issue.severity === "critical" && issue.autoFixable && issue.fixParams?.type === "regenerate_image"
              );

              if (criticalIssues.length > 0) {
                await sendEvent("task_update", { id: "autofix", status: "working", label: "Auto-Fix Visuals", group: "render" });

                for (const issue of criticalIssues) {
                  const idx = issue.sceneIndex;
                  await sendEvent("task_update", {
                    id: `fix-${idx}`,
                    status: "working",
                    label: `Fix Scene ${idx + 1}`,
                    group: "image",
                    detail: issue.description,
                  });

                  try {
                    const newPrompt = issue.fixParams?.newPrompt || scenes[idx].imagePrompt;
                    const newUrl = await generateImage(LOVABLE_KEY, newPrompt + ". Ensure consistent lighting, color palette, and professional quality.", aspect_ratio);
                    scenes[idx].imageUrl = newUrl;
                    await sendEvent("task_update", { id: `fix-${idx}`, status: "done", detail: "Regenerated" });
                  } catch (e: any) {
                    await sendEvent("task_update", { id: `fix-${idx}`, status: "error", detail: e.message });
                  }
                }

                await sendEvent("task_update", { id: "autofix", status: "done", detail: `Fixed ${criticalIssues.length} scenes` });
              }
            } else {
              await sendEvent("task_update", { id: "analysis", status: "done", detail: "Skipped" });
            }
          } catch (e: any) {
            console.error("Analysis error:", e);
            await sendEvent("task_update", { id: "analysis", status: "done", detail: "Skipped" });
          }

          // All assets ready — tell client to assemble
          await sendEvent("task_update", { id: "assemble", status: "working", label: "Assemble Video", group: "render" });
          await sendEvent("assets_complete", {
            title: script.title,
            scenes,
            aspectRatio: aspect_ratio,
          });

        } else if (action === "edit" && editOps && projectState) {
          // ── Edit existing project ──
          await sendEvent("task_update", { id: "ai-edit", status: "working", label: "Processing Edits" });

          // Handle regeneration operations server-side
          for (let i = 0; i < editOps.length; i++) {
            const op = editOps[i];
            if (op.type === "regenerate_image" && op.params?.newPrompt) {
              const idx = op.sceneIndex ?? 0;
              await sendEvent("task_update", { id: `regen-img-${i}`, status: "working", label: `Regenerate Scene ${idx + 1} Image` });
              try {
                const newUrl = await generateImage(LOVABLE_KEY, op.params.newPrompt, projectState.aspectRatio || "9:16");
                op._result = { imageUrl: newUrl };
                await sendEvent("task_update", { id: `regen-img-${i}`, status: "done" });
              } catch (e: any) {
                await sendEvent("task_update", { id: `regen-img-${i}`, status: "error", detail: e.message });
              }
            } else if (op.type === "regenerate_voice" && op.params?.newNarration && TTS_KEY) {
              const idx = op.sceneIndex ?? 0;
              await sendEvent("task_update", { id: `regen-tts-${i}`, status: "working", label: `Regenerate Scene ${idx + 1} Voice` });
              try {
                const newAudio = await generateTTS(TTS_KEY, op.params.newNarration);
                op._result = { audioBase64: newAudio };
                await sendEvent("task_update", { id: `regen-tts-${i}`, status: "done" });
              } catch (e: any) {
                await sendEvent("task_update", { id: `regen-tts-${i}`, status: "error", detail: e.message });
              }
            }
          }

          await sendEvent("task_update", { id: "ai-edit", status: "done" });
          await sendEvent("edit_complete", { operations: editOps });

        } else if (action === "regenerate_scene") {
          // ── Regenerate single scene ──
          const { sceneIndex, imagePrompt, narration } = await req.json();

          if (imagePrompt) {
            await sendEvent("task_update", { id: "regen-img", status: "working", label: "Regenerate Image" });
            const url = await generateImage(LOVABLE_KEY, imagePrompt, aspect_ratio);
            await sendEvent("task_update", { id: "regen-img", status: "done" });
            await sendEvent("scene_asset", { sceneIndex, type: "image", imageUrl: url });
          }

          if (narration && TTS_KEY) {
            await sendEvent("task_update", { id: "regen-tts", status: "working", label: "Regenerate Voice" });
            const audio = await generateTTS(TTS_KEY, narration);
            await sendEvent("task_update", { id: "regen-tts", status: "done" });
            await sendEvent("scene_asset", { sceneIndex, type: "audio", audioBase64: audio });
          }
        }

        await sendEvent("done", {});
      } catch (e: any) {
        console.error("Pipeline error:", e);
        await sendEvent("error", { message: e.message || "Pipeline failed" });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("video-render error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
