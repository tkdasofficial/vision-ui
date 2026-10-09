/**
 * Video editor engine — AI-driven editing operations + FFmpeg MP4 rendering.
 * All edit operations are applied to project state, then rendered via FFmpeg.
 */

import { renderToMP4, type RenderProject, type RenderScene, type RenderProgress, type RenderTask, type RenderTaskStatus } from "./ffmpeg-renderer";

// ── Re-export types ──
export type VideoProject = RenderProject;
export type EditorProgress = RenderProgress;
export type EditorTask = RenderTask;
export type EditorTaskStatus = RenderTaskStatus;

export type EditOperation = {
  type: string;
  sceneIndex?: number;
  params: Record<string, any>;
};

export type TextOverlay = {
  text: string;
  position: string;
  fontSize: number;
  fontColor: string;
};

type ProgressCallback = (progress: EditorProgress) => void;

// ── Apply edit operations to project state ──

export function applyOperations(project: VideoProject, operations: EditOperation[]): VideoProject {
  const p = JSON.parse(JSON.stringify(project)) as VideoProject;

  for (const op of operations) {
    const idx = op.sceneIndex ?? 0;
    const scene = p.scenes[idx];

    switch (op.type) {
      case "trim":
        if (scene) scene.duration = (op.params.endTime ?? scene.duration) - (op.params.startTime ?? 0);
        break;

      case "split":
        if (scene && op.params.splitTime) {
          const splitAt = op.params.splitTime;
          const newScene: RenderScene = JSON.parse(JSON.stringify(scene));
          scene.duration = splitAt;
          newScene.duration = newScene.duration - splitAt;
          p.scenes.splice(idx + 1, 0, newScene);
        }
        break;

      case "delete_scene":
        if (idx >= 0 && idx < p.scenes.length) p.scenes.splice(idx, 1);
        break;

      case "reorder":
        if (op.params.fromIndex !== undefined && op.params.toIndex !== undefined) {
          const [moved] = p.scenes.splice(op.params.fromIndex, 1);
          if (moved) p.scenes.splice(op.params.toIndex, 0, moved);
        }
        break;

      case "transition":
        if (scene) scene.transition = op.params.effect || "fade";
        break;

      case "text_overlay":
        if (scene) scene.textOverlays.push({
          text: op.params.text || "",
          position: op.params.position || "bottom",
          fontSize: op.params.fontSize || 48,
          fontColor: op.params.fontColor || "white",
        });
        break;

      case "filter":
        if (scene && op.params.filter) scene.filters.push(op.params.filter);
        break;

      case "speed":
        if (scene && op.params.factor) scene.speed = Math.max(0.25, Math.min(4.0, op.params.factor));
        break;

      case "zoom_pan":
        if (scene) scene.zoom = { start: op.params.zoomStart ?? 1.0, end: op.params.zoomEnd ?? 1.3 };
        break;

      case "adjust_timing":
        if (scene && op.params.duration) scene.duration = op.params.duration;
        break;

      case "crop":
        // Crop is handled at render time via FFmpeg filter
        if (scene) {
          (scene as any).crop = {
            x: op.params.cropX ?? 0,
            y: op.params.cropY ?? 0,
            w: op.params.cropWidth,
            h: op.params.cropHeight,
          };
        }
        break;

      case "color_grade":
        if (scene) {
          const grade = op.params.preset || "cinematic";
          if (!scene.filters.includes(grade)) scene.filters.push(grade);
        }
        break;

      case "remove_filter":
        if (scene && op.params.filter) {
          scene.filters = scene.filters.filter((f) => f !== op.params.filter);
        }
        break;

      case "clear_overlays":
        if (scene) scene.textOverlays = [];
        break;

      case "duplicate_scene":
        if (scene) {
          const dup: RenderScene = JSON.parse(JSON.stringify(scene));
          p.scenes.splice(idx + 1, 0, dup);
        }
        break;

      case "reverse":
        if (scene) scene.speed = -Math.abs(scene.speed);
        break;
    }
  }
  return p;
}

// ── Render project to MP4 via FFmpeg ──

export async function renderProject(
  project: VideoProject,
  onProgress: ProgressCallback
): Promise<string> {
  return renderToMP4(project, onProgress);
}
