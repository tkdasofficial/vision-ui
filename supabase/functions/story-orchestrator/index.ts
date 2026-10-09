// Story Creation & Visual Generation orchestrator
// Single action-routed edge function. Reuses Lovable AI Gateway for images
// and round-robin Gemini keys for all thinking / analysis / prompt work.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

function geminiKeys(): string[] {
  const out: string[] = [];
  for (const s of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${s}`);
    if (k) out.push(k);
  }
  return out;
}

async function gemini(prompt: string, opts: { json?: boolean; system?: string } = {}): Promise<string> {
  const keys = geminiKeys();
  if (!keys.length) throw new Error("No GEMINI_API_KEY configured");
  let lastErr = "";
  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: opts.json ? { responseMimeType: "application/json" } : {},
  };
  if (opts.system) body.system_instruction = { parts: [{ text: opts.system }] };
  for (const key of keys) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!r.ok) { lastErr = await r.text(); if (r.status !== 429 && r.status !== 503) break; continue; }
      const j = await r.json();
      const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      if (text) return text;
    } catch (e) { lastErr = String(e); }
  }
  throw new Error("Gemini failed: " + lastErr.slice(0, 300));
}

async function geminiJson<T = any>(prompt: string, system?: string): Promise<T> {
  const raw = await gemini(prompt, { json: true, system });
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned) as T; }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Gemini returned non-JSON");
  }
}

async function generateImage(prompt: string, size = "1024x1024"): Promise<string | null> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", prompt, n: 1, size }),
    });
    if (!r.ok) { console.error("image gen failed", r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch (e) { console.error("image gen error", e); return null; }
}

// -------------------- prompts --------------------

const ANALYSIS_SYSTEM = `You are a senior story development editor. Think deeply about narrative structure, characters, environment, emotion and visual style. Return strict JSON only.`;

function analysisPrompt(p: any, script: string) {
  return `Analyze this story for visual production.
Topic: ${p.topic}
Category: ${p.category}
Audience: ${p.audience}
Language: ${p.language}
Length: ${p.length}
${script ? `\nScript:\n${script}` : "\nNo script yet — infer a complete outline from the topic."}

Return JSON with this exact shape:
{
  "title": string,
  "category": string,
  "estimatedDurationMinutes": number,
  "visualStyle": string,
  "mood": [string],
  "theme": string,
  "timeline": string,
  "characters": [{ "name": string, "role": string, "appearance": string, "outfit": string, "personality": string }],
  "locations": [{ "name": string, "description": string, "atmosphere": string }],
  "estimatedScenes": number,
  "estimatedImages": number,
  "structure": { "act1": string, "act2": string, "act3": string }
}`;
}

const SCENE_SYSTEM = `You are a cinematic storyboard director. Break stories into clean visual scenes with consistent characters, environments, and lighting. Return JSON only.`;

function scenesPrompt(p: any) {
  return `Story: ${p.title}
Analysis: ${JSON.stringify(p.analysis)}
${p.script ? `Script:\n${p.script}` : ""}

Break into ${p.analysis?.estimatedScenes ?? 20} sequential scenes covering the whole story.
Return JSON array; each scene:
{
  "index": number,
  "title": string,
  "summary": string,
  "characters": [name],
  "location": string,
  "action": string,
  "mood": string,
  "cameraAngle": string,
  "lighting": string,
  "imagesNeeded": number
}`;
}

function promptsPrompt(p: any) {
  return `For each scene below, write 1 maximally detailed cinematic image prompt per imagesNeeded.
Maintain absolute consistency: same faces, same outfits, same environment style across all scenes.
Characters reference: ${JSON.stringify(p.characters.map((c: any) => ({ name: c.name, appearance: c.appearance, outfit: c.outfit })))}
Visual style: ${p.analysis.visualStyle}
Mood palette: ${(p.analysis.mood || []).join(", ")}

Scenes: ${JSON.stringify(p.scenes)}

Return JSON array of prompts:
[{ "sceneIndex": number, "imageIndex": number, "characters": [name], "prompt": string }]
The "prompt" must be a single dense paragraph including character description, outfit, location, lighting, camera angle, mood, and "${p.analysis.visualStyle}, ultra detailed, cinematic" suffix.`;
}

function reviewPrompt(p: any) {
  return `Audit these image prompts for character/outfit/environment/style consistency.
Characters: ${JSON.stringify(p.characters.map((c: any) => ({ name: c.name, appearance: c.appearance, outfit: c.outfit })))}
Visual style: ${p.analysis.visualStyle}

Prompts: ${JSON.stringify(p.prompts)}

For every prompt, rewrite the "prompt" field to enforce consistency (lock in face, outfit, lighting, style). Fix any contradictions silently.
Return JSON: { "fixed": [<same prompt objects with corrected "prompt">], "issuesFound": number, "notes": string }`;
}

// -------------------- handlers --------------------

async function loadProject(sb: any, userId: string, projectId: string) {
  const { data, error } = await sb.from("story_projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Project not found");
  return data;
}

async function save(sb: any, projectId: string, patch: Record<string, any>) {
  const { error } = await sb.from("story_projects").update(patch).eq("id", projectId);
  if (error) throw new Error(error.message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, userId } = body;
    if (!userId) throw new Error("userId required");
    const sb = admin();

    switch (action) {
      case "create": {
        const { sessionId, topic, category, audience, language, length, hasScript, hasAudio, script, audioUrl } = body;
        const { data, error } = await sb.from("story_projects").insert({
          user_id: userId, session_id: sessionId ?? null,
          topic, category, audience, language: language || "English", length,
          status: script ? "analyzing" : (hasAudio && !script ? "transcribing" : "analyzing"),
          script: script || null, audio_url: audioUrl || null,
          progress: { stage: "created" },
        }).select().single();
        if (error) throw new Error(error.message);
        if (sessionId) {
          await sb.from("chat_sessions").update({ mode: "story", story_state: { projectId: data.id } }).eq("id", sessionId);
        }
        return json({ project: data });
      }

      case "analyze": {
        const p = await loadProject(sb, userId, body.projectId);
        await save(sb, p.id, { status: "analyzing", progress: { stage: "analyzing" } });
        let script = p.script;
        if (!script) {
          // Generate a script first
          const generated = await gemini(`Write a complete ${p.length || "5-minute"} ${p.category || ""} story in ${p.language || "English"} about "${p.topic}". Target audience: ${p.audience || "general"}. Use vivid sensory detail.`);
          script = generated;
        }
        const analysis = await geminiJson<any>(analysisPrompt(p, script), ANALYSIS_SYSTEM);
        await save(sb, p.id, {
          script,
          title: analysis.title || p.topic,
          analysis,
          status: "analysis_ready",
          progress: { stage: "analysis_ready" },
        });
        return json({ ok: true });
      }

      case "update_analysis": {
        const p = await loadProject(sb, userId, body.projectId);
        const merged = { ...p.analysis, ...body.patch };
        await save(sb, p.id, { analysis: merged });
        return json({ ok: true });
      }

      case "approve_analysis": {
        await save(sb, body.projectId, { status: "characters_pending", progress: { stage: "characters_pending" } });
        return json({ ok: true });
      }

      case "generate_characters": {
        const p = await loadProject(sb, userId, body.projectId);
        const chars = (p.analysis?.characters || []) as any[];
        const angles = ["front view portrait", "side profile view", "back view full body", "outfit detail close-up"];
        const out: any[] = [];
        await save(sb, p.id, { status: "generating_characters", progress: { stage: "generating_characters", total: chars.length * angles.length, done: 0 } });
        let done = 0;
        for (const c of chars) {
          const images: Record<string, string | null> = {};
          for (const a of angles) {
            const prompt = `${p.analysis?.visualStyle || "cinematic photorealistic"} character reference sheet, ${a}, of ${c.name}: ${c.appearance}. Outfit: ${c.outfit}. Neutral studio background, even lighting, ultra detailed, consistent character reference.`;
            const url = await generateImage(prompt, "1024x1024");
            images[a] = url;
            done++;
            await save(sb, p.id, { progress: { stage: "generating_characters", total: chars.length * angles.length, done } });
          }
          out.push({ name: c.name, role: c.role, appearance: c.appearance, outfit: c.outfit, personality: c.personality, images });
        }
        await save(sb, p.id, { characters: out, status: "characters_ready", progress: { stage: "characters_ready" } });
        return json({ ok: true });
      }

      case "plan_scenes": {
        const p = await loadProject(sb, userId, body.projectId);
        const scenes = await geminiJson<any[]>(scenesPrompt(p), SCENE_SYSTEM);
        await save(sb, p.id, { scenes, status: "scenes_ready", progress: { stage: "scenes_ready", scenes: scenes.length } });
        return json({ ok: true });
      }

      case "generate_prompts": {
        const p = await loadProject(sb, userId, body.projectId);
        const prompts = await geminiJson<any[]>(promptsPrompt(p), SCENE_SYSTEM);
        await save(sb, p.id, { prompts, status: "prompts_ready", progress: { stage: "prompts_ready", prompts: prompts.length } });
        return json({ ok: true });
      }

      case "self_review": {
        const p = await loadProject(sb, userId, body.projectId);
        const result = await geminiJson<{ fixed: any[]; issuesFound: number; notes: string }>(reviewPrompt(p), SCENE_SYSTEM);
        await save(sb, p.id, {
          prompts: result.fixed || p.prompts,
          status: "reviewed",
          progress: { stage: "reviewed", issuesFound: result.issuesFound ?? 0, notes: result.notes || "" },
        });
        return json({ ok: true });
      }

      case "generate_images_batch": {
        const p = await loadProject(sb, userId, body.projectId);
        const mode = body.mode || p.generation_mode || "batch";
        const batchSize = mode === "sequential" ? 1 : 5;
        const existing: any[] = Array.isArray(p.prompts) ? p.prompts : [];
        const pending = existing.filter((x) => !x.imageUrl);
        const slice = pending.slice(0, batchSize);
        await save(sb, p.id, { status: "generating_images", generation_mode: mode, progress: { stage: "generating_images", total: existing.length, done: existing.length - pending.length } });
        for (const prompt of slice) {
          const url = await generateImage(prompt.prompt, "1024x1024");
          prompt.imageUrl = url;
          const done = existing.filter((x) => x.imageUrl).length;
          await save(sb, p.id, { prompts: existing, progress: { stage: "generating_images", total: existing.length, done } });
        }
        const remaining = existing.filter((x) => !x.imageUrl).length;
        await save(sb, p.id, {
          prompts: existing,
          status: remaining === 0 ? "done" : "generating_images",
          progress: { stage: remaining === 0 ? "done" : "generating_images", total: existing.length, done: existing.length - remaining },
        });
        return json({ ok: true, remaining });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("story-orchestrator error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
