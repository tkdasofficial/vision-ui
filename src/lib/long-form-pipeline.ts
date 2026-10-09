/**
 * Long-form video pipeline — server-side stock footage + TTS, client-side FFmpeg MP4 rendering.
 * Uses Pexels stock footage instead of AI-generated images.
 * Supports chapter-based structure for professional long-form content.
 */

import { renderToMP4, type RenderScene, type RenderProject } from "./ffmpeg-renderer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

export type LongFormScene = RenderScene & {
  videoSourceUrl?: string;
  previewUrl?: string;
  pexelsId?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceDuration?: number;
  chapterTitle?: string;
  chapterNumber?: number;
  stockKeywords?: string[];
  visualDescription?: string;
  mood?: string;
  shotType?: string;
};

export type Chapter = {
  number: number;
  title: string;
};

export type LongFormScript = {
  title: string;
  chapters: Chapter[];
  totalScenes: number;
};

export type TaskStatus = "pending" | "working" | "done" | "error";

export type WorkerTask = {
  id: string;
  label: string;
  group: "script" | "footage" | "voice" | "render" | "export";
  status: TaskStatus;
  detail?: string;
};

export type LongFormPipelineState = {
  tasks: WorkerTask[];
  script?: LongFormScript;
  chapters?: Chapter[];
  videoUrl?: string;
  overallProgress: number;
  error?: string;
  contentType: "long";
};

type ProgressCallback = (state: LongFormPipelineState) => void;

// ── Helpers ──

function calcProgress(tasks: WorkerTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}

// ── Long-form pipeline ──

export async function runLongFormPipeline(
  topic: string,
  duration: number,
  aspectRatio: string,
  onProgress: ProgressCallback
): Promise<string> {
  let tasks: WorkerTask[] = [
    { id: "script", label: "Writing Script", group: "script", status: "pending" },
  ];
  let script: LongFormScript | undefined;
  let chapters: Chapter[] | undefined;
  let assemblyScenes: LongFormScene[] = [];

  const emit = (extra?: Partial<LongFormPipelineState>) => {
    onProgress({
      tasks: [...tasks],
      overallProgress: calcProgress(tasks),
      script,
      chapters,
      contentType: "long",
      ...extra,
    });
  };

  try {
    // Connect to server-side long-form pipeline via SSE
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/long-form-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ topic, duration, aspect_ratio: aspectRatio }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Long-form pipeline failed");
    }

    // Process SSE events
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assetsComplete = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          switch (event.type) {
            case "task_update": {
              const existing = tasks.find((t) => t.id === event.id);
              if (existing) {
                existing.status = event.status;
                if (event.detail) existing.detail = event.detail;
                if (event.label) existing.label = event.label;
              } else {
                // Map group names
                let group: WorkerTask["group"] = event.group || "script";
                if (group === "footage" as any) group = "footage";
                tasks.push({
                  id: event.id,
                  label: event.label || event.id,
                  group,
                  status: event.status,
                  detail: event.detail,
                });
              }
              emit();
              break;
            }

            case "script_ready":
              script = {
                title: event.script?.title || topic,
                chapters: event.script?.chapters?.map((c: any) => ({
                  number: c.chapterNumber,
                  title: c.chapterTitle,
                })) || [],
                totalScenes: event.totalScenes || 0,
              };
              emit();
              break;

            case "scene_ready":
              assemblyScenes[event.index] = event.scene;
              break;

            case "assets_complete":
              assetsComplete = true;
              assemblyScenes = event.scenes;
              chapters = event.chapters;
              script = {
                title: event.title,
                chapters: event.chapters || [],
                totalScenes: event.scenes.length,
              };
              break;

            case "error":
              throw new Error(event.message);

            case "done":
              break;
          }
        } catch (e: any) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }

    if (!assetsComplete || assemblyScenes.length === 0) {
      throw new Error("Server did not complete asset generation");
    }

    // ── Client-side FFmpeg MP4 rendering ──
    // For stock footage scenes, use the video thumbnail as the image source
    // The FFmpeg renderer will handle the image -> video conversion
    const renderTask: WorkerTask = { id: "ffmpeg-render", label: "FFmpeg Render", group: "render", status: "working" };
    tasks.push(renderTask);
    emit();

    const renderProject: RenderProject = {
      title: script?.title || topic,
      scenes: assemblyScenes.map((s) => ({
        imageUrl: s.videoSourceUrl || s.imageUrl, // Use video source URL if available
        audioBase64: s.audioBase64,
        duration: s.duration,
        narration: s.narration,
        transition: s.transition,
        filters: s.filters || [],
        textOverlays: s.textOverlays || [],
        speed: s.speed || 1.0,
        zoom: s.zoom,
      })),
      aspectRatio,
    };

    const videoUrl = await renderToMP4(renderProject, (progress) => {
      renderTask.detail = progress.tasks.find((t) => t.status === "working")?.detail || "Rendering...";
      emit();

      if (progress.videoUrl) {
        renderTask.status = "done";
        renderTask.detail = "Complete";
        emit({ videoUrl: progress.videoUrl });
      }
    });

    renderTask.status = "done";
    renderTask.detail = "MP4 ready";
    emit({ videoUrl });

    return videoUrl;
  } catch (e: any) {
    onProgress({
      tasks: [...tasks],
      overallProgress: calcProgress(tasks),
      error: e.message || "Pipeline failed",
      contentType: "long",
    });
    throw e;
  }
}
