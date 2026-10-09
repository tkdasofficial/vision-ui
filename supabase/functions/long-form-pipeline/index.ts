import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Orientation from aspect ratio ──
function getOrientation(ar: string): string {
  if (ar === "9:16" || ar === "3:4" || ar === "4:5" || ar === "2:3") return "portrait";
  if (ar === "1:1") return "square";
  return "landscape";
}

// ── Gather all Gemini keys for fallback ──
function getGeminiKeys(): string[] {
  const keys: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
    if (k) keys.push(k);
  }
  return keys;
}

// ── Call Gemini with key fallback ──
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

// ── Generate long-form script with chapters via Gemini ──
async function generateLongFormScript(
  topic: string, duration: number, aspectRatio: string, style: string
): Promise<any> {
  // For long-form: generate chapters first, then scenes within each chapter
  const totalScenes = Math.max(6, Math.min(60, Math.round(duration / 5)));
  const chapterCount = Math.max(2, Math.min(8, Math.round(totalScenes / 6)));

  const systemPrompt = `You are an expert long-form video scriptwriter and stock footage director. Return ONLY valid JSON.

Generate a detailed script with ${chapterCount} chapters and approximately ${totalScenes} total scenes for a ${duration}-second video (${aspectRatio}, style: ${style}).

CRITICAL RULES FOR STOCK FOOTAGE:
- Each scene's "stockKeywords" must be 2-4 highly specific, searchable stock video keywords
- Keywords must describe REAL filmable footage (nature, people, cities, technology, etc.)
- NEVER use abstract/conceptual keywords that won't exist as stock footage
- Think like a professional video editor searching Pexels: "aerial city skyline sunset", "woman typing laptop office", "ocean waves slow motion"
- Each scene should have a PRIMARY keyword (most important) and FALLBACK keywords
- Vary keywords to avoid repetitive footage — each scene should feel visually distinct
- Consider B-roll variety: wide establishing shots, medium detail shots, close-ups

Return format:
{
  "title": "...",
  "chapters": [
    {
      "chapterNumber": 1,
      "chapterTitle": "Chapter Name",
      "scenes": [
        {
          "sceneNumber": 1,
          "narration": "Voice over text...",
          "stockKeywords": ["primary keyword", "fallback keyword 1", "fallback keyword 2"],
          "visualDescription": "What the viewer should see — describes the ideal footage",
          "duration": 5,
          "transition": "fade",
          "mood": "energetic|calm|dramatic|inspiring|serious|playful",
          "shotType": "wide|medium|closeup|aerial|tracking|timelapse"
        }
      ]
    }
  ]
}

Rules:
- Natural, conversational narration with a strong hook opening
- Duration per scene: 4-8 seconds for dynamic pacing
- Transitions: fade (default), cut (fast pacing), dissolve (emotional), slide (new chapter)
- Each chapter should have a thematic arc
- Stock keywords must be concrete and visual: "golden sunset beach waves" not "concept of peace"
- Shot types should vary within chapters for visual interest
- Total scene durations should sum to approximately ${duration} seconds`;

  const data = await callGemini({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: `Create a ${duration}s long-form video about: ${topic}` }] }],
    generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
  });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No script generated");
  const parsed = JSON.parse(text);
  if (!parsed.chapters?.length) throw new Error("Invalid long-form script structure");
  return parsed;
}

// ── Search Pexels for best matching stock footage ──
async function searchStockFootage(
  pexelsKey: string, keywords: string[], orientation: string, duration?: number
): Promise<{ videoUrl: string; previewUrl: string; thumbnailUrl: string; pexelsId: number; width: number; height: number; videoDuration: number } | null> {
  // Try each keyword in priority order
  for (const keyword of keywords) {
    try {
      const params = new URLSearchParams({
        query: keyword,
        per_page: "15",
        orientation,
        size: "medium",
      });

      const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
        headers: { Authorization: pexelsKey },
      });

      if (!res.ok) continue;
      const data = await res.json();
      const videos = data.videos || [];

      if (videos.length === 0) continue;

      // Score videos by relevance and quality
      const scored = videos.map((v: any) => {
        let score = 0;
        const hdFile = v.video_files?.find((f: any) => f.quality === "hd" && f.width >= 1280);
        const sdFile = v.video_files?.find((f: any) => f.quality === "sd");
        const bestFile = hdFile || sdFile || v.video_files?.[0];

        if (!bestFile?.link) return { v, score: -1, file: null };

        // Prefer HD
        if (hdFile) score += 30;
        // Prefer videos close to desired duration
        if (duration && v.duration) {
          const durDiff = Math.abs(v.duration - duration);
          if (durDiff < 3) score += 25;
          else if (durDiff < 8) score += 15;
          else if (durDiff < 15) score += 5;
        }
        // Prefer wider/taller based on orientation
        if (orientation === "landscape" && v.width > v.height) score += 10;
        if (orientation === "portrait" && v.height > v.width) score += 10;
        // Higher resolution bonus
        if (bestFile.width >= 1920) score += 10;

        return { v, score, file: bestFile };
      }).filter((s: any) => s.score >= 0 && s.file);

      // Sort by score descending
      scored.sort((a: any, b: any) => b.score - a.score);

      // Pick from top 5 randomly for variety
      const topN = scored.slice(0, Math.min(5, scored.length));
      const pick = topN[Math.floor(Math.random() * topN.length)];

      if (pick) {
        return {
          videoUrl: pick.file.link,
          previewUrl: (sdFile || pick.file).link,
          thumbnailUrl: pick.v.image,
          pexelsId: pick.v.id,
          width: pick.file.width || pick.v.width,
          height: pick.file.height || pick.v.height,
          videoDuration: pick.v.duration,
        };
      }
    } catch (e) {
      console.error(`Pexels search failed for "${keyword}":`, e);
      continue;
    }
  }
  return null;
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
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.0, sampleRateHertz: 24000 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS error [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.audioContent;
}

// ── Deduplicate footage across scenes ──
const usedVideoIds = new Set<number>();

function isVideoUsed(id: number): boolean {
  return usedVideoIds.has(id);
}
function markVideoUsed(id: number): void {
  usedVideoIds.add(id);
}

// ── Search with deduplication ──
async function findUniqueFootage(
  pexelsKey: string, keywords: string[], orientation: string, duration: number, maxRetries = 3
): Promise<{ videoUrl: string; previewUrl: string; thumbnailUrl: string; pexelsId: number; width: number; height: number; videoDuration: number } | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // On retries, shuffle keywords or add modifiers
    const searchKeywords = attempt === 0
      ? keywords
      : keywords.map((k) => attempt === 1 ? `${k} cinematic` : `${k} footage`);

    for (const keyword of searchKeywords) {
      try {
        const params = new URLSearchParams({
          query: keyword,
          per_page: "30",
          orientation,
          size: "medium",
          page: String(attempt + 1),
        });

        const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
          headers: { Authorization: pexelsKey },
        });

        if (!res.ok) continue;
        const data = await res.json();
        const videos = (data.videos || []).filter((v: any) => !isVideoUsed(v.id));

        if (videos.length === 0) continue;

        // Score and pick
        const scored = videos.map((v: any) => {
          let score = 0;
          const hdFile = v.video_files?.find((f: any) => f.quality === "hd" && f.width >= 1280);
          const sdFile = v.video_files?.find((f: any) => f.quality === "sd");
          const bestFile = hdFile || sdFile || v.video_files?.[0];
          if (!bestFile?.link) return null;

          if (hdFile) score += 30;
          const durDiff = Math.abs(v.duration - duration);
          if (durDiff < 3) score += 25;
          else if (durDiff < 8) score += 15;
          if (bestFile.width >= 1920) score += 10;

          return { v, score, file: bestFile, sdFile };
        }).filter(Boolean);

        scored.sort((a: any, b: any) => b.score - a.score);
        const topN = scored.slice(0, Math.min(5, scored.length));
        const pick = topN[Math.floor(Math.random() * topN.length)];

        if (pick) {
          markVideoUsed(pick.v.id);
          return {
            videoUrl: pick.file.link,
            previewUrl: (pick.sdFile || pick.file).link,
            thumbnailUrl: pick.v.image,
            pexelsId: pick.v.id,
            width: pick.file.width || pick.v.width,
            height: pick.file.height || pick.v.height,
            videoDuration: pick.v.duration,
          };
        }
      } catch { continue; }
    }
  }
  return null;
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, duration = 120, aspect_ratio = "16:9", style = "cinematic" } = await req.json();

    const TTS_KEY = Deno.env.get("GOOGLE_TTS_API_KEY");
    const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY");

    if (getGeminiKeys().length === 0) throw new Error("No Gemini API keys configured");
    if (!PEXELS_KEY) throw new Error("PEXELS_API_KEY not configured");

    const orientation = getOrientation(aspect_ratio);

    // ── STREAM progress via SSE ──
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (type: string, data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
    };

    (async () => {
      try {
        // ── PHASE 1: Script Generation ──
        await sendEvent("task_update", { id: "script", status: "working", label: "Writing Script", group: "script" });

        const script = await generateLongFormScript(topic, duration, aspect_ratio, style);

        // Flatten all scenes from chapters
        const allScenes: any[] = [];
        for (const chapter of script.chapters) {
          for (const scene of chapter.scenes) {
            allScenes.push({
              ...scene,
              chapterTitle: chapter.chapterTitle,
              chapterNumber: chapter.chapterNumber,
            });
          }
        }

        await sendEvent("task_update", {
          id: "script",
          status: "done",
          label: "Script Written",
          detail: `${script.chapters.length} chapters, ${allScenes.length} scenes`,
        });
        await sendEvent("script_ready", { script, totalScenes: allScenes.length });

        // ── PHASE 2: Announce all tasks ──
        for (let i = 0; i < allScenes.length; i++) {
          await sendEvent("task_update", { id: `footage-${i}`, status: "pending", label: `Scene ${i + 1} Footage`, group: "footage" });
          await sendEvent("task_update", { id: `tts-${i}`, status: "pending", label: `Scene ${i + 1} Voice`, group: "voice" });
        }

        // ── PHASE 3: AI Keyword Optimization ──
        await sendEvent("task_update", { id: "keywords", status: "working", label: "Optimizing Search Keywords", group: "footage" });

        // Use Gemini to refine all keywords in one batch for consistency
        const keywordPrompt = `You are a professional stock footage researcher. Given these scene descriptions, generate the BEST Pexels search keywords for each scene.

Rules:
- Each scene needs exactly 3 keywords: [primary, fallback_1, fallback_2]
- Keywords must be highly specific and searchable on stock video platforms
- Avoid duplicate keywords across scenes — each scene should find DIFFERENT footage
- Think about visual variety: mix wide shots, close-ups, aerials, timelapses
- Keywords must describe REAL filmed footage, not abstract concepts
- Add modifiers like "slow motion", "aerial", "close up", "timelapse" for variety

Scenes:
${allScenes.map((s, i) => `Scene ${i + 1} (${s.chapterTitle}): "${s.narration}" — Visual: ${s.visualDescription || s.stockKeywords?.join(", ")}`).join("\n")}

Return JSON: { "scenes": [{ "index": 0, "keywords": ["primary", "fallback1", "fallback2"] }] }`;

        try {
          const kwData = await callGemini({
            contents: [{ role: "user", parts: [{ text: keywordPrompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
          });
          const kwText = kwData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (kwText) {
            const refined = JSON.parse(kwText);
            for (const entry of (refined.scenes || [])) {
              if (entry.index >= 0 && entry.index < allScenes.length && entry.keywords?.length) {
                allScenes[entry.index].stockKeywords = entry.keywords;
              }
            }
          }
        } catch (e) {
          console.error("Keyword refinement failed, using original keywords:", e);
        }

        await sendEvent("task_update", { id: "keywords", status: "done", label: "Keywords Optimized", detail: `${allScenes.length} scenes` });

        // ── PHASE 4: Fetch Stock Footage + TTS in parallel per scene ──
        // Clear dedup set for this pipeline run
        usedVideoIds.clear();

        const assembledScenes: any[] = [];

        for (let i = 0; i < allScenes.length; i++) {
          const scene = allScenes[i];

          // ── Stock footage search ──
          await sendEvent("task_update", { id: `footage-${i}`, status: "working", detail: scene.stockKeywords?.[0] || "Searching..." });

          const footage = await findUniqueFootage(
            PEXELS_KEY,
            scene.stockKeywords || ["generic footage"],
            orientation,
            scene.duration
          );

          if (footage) {
            await sendEvent("task_update", {
              id: `footage-${i}`,
              status: "done",
              detail: `Found (${footage.width}x${footage.height})`,
            });
          } else {
            await sendEvent("task_update", { id: `footage-${i}`, status: "error", detail: "No matching footage" });
            // Use a fallback generic search
            const fallback = await findUniqueFootage(PEXELS_KEY, [topic, "cinematic"], orientation, scene.duration);
            if (fallback) {
              await sendEvent("task_update", { id: `footage-${i}`, status: "done", detail: "Used fallback" });
              Object.assign(footage || {}, fallback);
            }
          }

          // ── TTS ──
          await sendEvent("task_update", { id: `tts-${i}`, status: "working" });
          let audioBase64 = "";
          if (TTS_KEY) {
            try {
              audioBase64 = await generateTTS(TTS_KEY, scene.narration);
              await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "Ready" });
            } catch (e: any) {
              await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "Skipped" });
            }
          } else {
            await sendEvent("task_update", { id: `tts-${i}`, status: "done", detail: "No TTS key" });
          }

          const assembledScene = {
            sceneNumber: i + 1,
            narration: scene.narration,
            stockKeywords: scene.stockKeywords,
            visualDescription: scene.visualDescription,
            chapterTitle: scene.chapterTitle,
            chapterNumber: scene.chapterNumber,
            duration: scene.duration,
            transition: scene.transition || "fade",
            mood: scene.mood,
            shotType: scene.shotType,
            // Video footage URL — client will use this as the visual source
            imageUrl: footage?.thumbnailUrl || "",
            videoSourceUrl: footage?.videoUrl || "",
            previewUrl: footage?.previewUrl || "",
            pexelsId: footage?.pexelsId,
            sourceWidth: footage?.width || 1280,
            sourceHeight: footage?.height || 720,
            sourceDuration: footage?.videoDuration || scene.duration,
            audioBase64,
            filters: [],
            textOverlays: [],
            speed: 1.0,
          };

          assembledScenes.push(assembledScene);
          await sendEvent("scene_ready", { index: i, scene: assembledScene });
        }

        // ── PHASE 5: Signal completion ──
        await sendEvent("task_update", { id: "assemble", status: "working", label: "Ready for Assembly", group: "render" });
        await sendEvent("assets_complete", {
          title: script.title,
          scenes: assembledScenes,
          chapters: script.chapters.map((c: any) => ({ number: c.chapterNumber, title: c.chapterTitle })),
          aspectRatio: aspect_ratio,
          contentType: "long",
          footageSource: "pexels",
        });

        await sendEvent("done", {});
      } catch (e: any) {
        console.error("Long-form pipeline error:", e);
        await sendEvent("error", { message: e.message || "Pipeline failed" });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("long-form-pipeline error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
