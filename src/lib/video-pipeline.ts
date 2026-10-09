/**
 * Video pipeline — server-side asset generation + client-side FFmpeg MP4 rendering.
 * All AI work (script, images, TTS) runs server-side via SSE streaming.
 * Final encoding uses FFmpeg WASM for professional H.264 MP4 output.
 */

import { renderToMP4, type RenderScene, type RenderProject } from "./ffmpeg-renderer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

export type VideoScene = {
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
  duration: number;
  transition: string;
};

export type VideoScript = {
  title: string;
  scenes: VideoScene[];
};

export type TaskStatus = "pending" | "working" | "done" | "error";

export type WorkerTask = {
  id: string;
  label: string;
  group: "script" | "image" | "voice" | "render" | "export";
  status: TaskStatus;
  detail?: string;
  sceneIndex?: number;
};

export type PipelineState = {
  tasks: WorkerTask[];
  script?: VideoScript;
  videoUrl?: string;
  overallProgress: number;
  error?: string;
};

type ProgressCallback = (state: PipelineState) => void;

// ── Helpers ──

function calcProgress(tasks: WorkerTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}

// ── Server-Side Pipeline with SSE + Client FFmpeg rendering ──

export async function runVideoPipeline(
  topic: string,
  duration: number,
  aspectRatio: string,
  onProgress: ProgressCallback
): Promise<string> {
  let tasks: WorkerTask[] = [
    { id: "script", label: "Write Script", group: "script", status: "pending" },
  ];
  let script: VideoScript | undefined;
  let assemblyScenes: RenderScene[] = [];

  const emit = (extra?: Partial<PipelineState>) => {
    onProgress({ tasks: [...tasks], overallProgress: calcProgress(tasks), script, ...extra });
  };

  try {
    // Connect to server-side pipeline via SSE
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/video-render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action: "generate", topic, duration, aspect_ratio: aspectRatio }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Server pipeline failed");
    }

    // Process SSE events from server
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
                tasks.push({
                  id: event.id,
                  label: event.label || event.id,
                  group: event.group || "script",
                  status: event.status,
                  detail: event.detail,
                });
              }
              emit();
              break;
            }

            case "script_ready":
              script = event.script;
              emit();
              break;

            case "scene_ready":
              assemblyScenes[event.index] = event.scene;
              break;

            case "assets_complete":
              assetsComplete = true;
              assemblyScenes = event.scenes;
              script = { title: event.title, scenes: event.scenes };
              break;

            case "visual_analysis":
              // Analysis results available — emit for UI display
              emit({ visualAnalysis: event.analysis } as any);
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
    const renderTask: WorkerTask = { id: "ffmpeg-render", label: "FFmpeg Render", group: "render", status: "working" };
    tasks.push(renderTask);
    emit();

    const renderProject: RenderProject = {
      title: script?.title || topic,
      scenes: assemblyScenes,
      aspectRatio,
    };

    const videoUrl = await renderToMP4(renderProject, (progress) => {
      // Merge FFmpeg render tasks
      const renderTasks = progress.tasks.map((t) => ({
        ...t,
        group: "render" as const,
      }));
      
      // Replace render-related tasks
      const nonRenderTasks = tasks.filter((t) => t.group !== "render" || t.id === "ffmpeg-render");
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
    });
    throw e;
  }
}

// Re-export types for editor engine compatibility
export type { RenderScene as AssemblyScene, RenderProject as AssemblyProject };
