/**
 * FFmpeg-based client-side MP4 renderer.
 * Uses @ffmpeg/ffmpeg (WASM) for professional-grade video encoding.
 * Supports: H.264 MP4, complex filter chains, audio mixing, transitions, overlays.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

// ── Types ──

export type RenderScene = {
  imageUrl: string;
  audioBase64: string;
  duration: number;
  narration: string;
  transition: string;
  filters: string[];
  textOverlays: { text: string; position: string; fontSize: number; fontColor: string }[];
  speed: number;
  zoom?: { start: number; end: number };
};

export type RenderProject = {
  title: string;
  scenes: RenderScene[];
  aspectRatio: string;
};

export type RenderTaskStatus = "pending" | "working" | "done" | "error";

export type RenderTask = {
  id: string;
  label: string;
  status: RenderTaskStatus;
  detail?: string;
};

export type RenderProgress = {
  tasks: RenderTask[];
  overallProgress: number;
  videoUrl?: string;
  error?: string;
  project?: RenderProject;
};

type ProgressCallback = (progress: RenderProgress) => void;

// ── FFmpeg singleton ──

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    onLog?.(message);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;
  return ffmpeg;
}

// ── Dimensions ──

function getDimensions(ar: string): { w: number; h: number } {
  const map: Record<string, [number, number]> = {
    "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [720, 720],
    "4:3": [960, 720], "4:5": [720, 900], "3:4": [720, 960],
  };
  const [w, h] = map[ar] || [720, 1280];
  return { w, h };
}

// ── Convert base64 to Uint8Array ──

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Build FFmpeg filter string for a scene ──

function buildSceneFilter(scene: RenderScene, w: number, h: number, index: number): string {
  const filters: string[] = [];

  // Base: scale to fit canvas with cover
  filters.push(`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`);

  // Zoom / Ken Burns effect
  if (scene.zoom) {
    const zs = scene.zoom.start;
    const ze = scene.zoom.end;
    filters.push(
      `zoompan=z='${zs}+(${ze}-${zs})*on/(${Math.ceil(scene.duration * 25)})':d=${Math.ceil(scene.duration * 25)}:s=${w}x${h}:fps=25`
    );
  }

  // Speed adjustment
  if (scene.speed !== 1.0) {
    const pts = 1 / scene.speed;
    filters.push(`setpts=${pts.toFixed(4)}*PTS`);
  }

  // Visual filters
  for (const f of scene.filters) {
    switch (f) {
      case "brighten": filters.push("eq=brightness=0.08"); break;
      case "darken": filters.push("eq=brightness=-0.12"); break;
      case "warm": filters.push("colorbalance=rs=0.08:gs=0.02:bs=-0.06"); break;
      case "cool": filters.push("colorbalance=rs=-0.06:gs=0.02:bs=0.08"); break;
      case "saturate": filters.push("eq=saturation=1.4"); break;
      case "desaturate": filters.push("eq=saturation=0.5"); break;
      case "contrast": filters.push("eq=contrast=1.3"); break;
      case "vintage": filters.push("colorbalance=rs=0.1:gs=0.05:bs=-0.08,eq=saturation=0.7,eq=contrast=1.1"); break;
      case "cinematic": filters.push("eq=contrast=1.2:saturation=0.85,colorbalance=rs=0.02:bs=-0.04"); break;
      case "noir": filters.push("hue=s=0,eq=contrast=1.3:brightness=-0.05"); break;
      case "blur": filters.push("boxblur=3:1"); break;
    }
  }

  // Fade transition
  if (scene.transition === "fade" || scene.transition === "dissolve") {
    const fadeDur = Math.min(0.5, scene.duration * 0.15);
    filters.push(`fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${(scene.duration - fadeDur).toFixed(2)}:d=${fadeDur}`);
  }

  return filters.join(",");
}

// ── Build drawtext filter for text overlays ──

function buildTextFilter(overlay: RenderScene["textOverlays"][0], w: number, h: number): string {
  const fontSize = overlay.fontSize || Math.round(h * 0.05);
  const color = overlay.fontColor || "white";

  const posMap: Record<string, string> = {
    top: `x=(w-text_w)/2:y=${Math.round(h * 0.06)}`,
    center: `x=(w-text_w)/2:y=(h-text_h)/2`,
    bottom: `x=(w-text_w)/2:y=h-text_h-${Math.round(h * 0.08)}`,
    "top-left": `x=${Math.round(w * 0.05)}:y=${Math.round(h * 0.06)}`,
    "top-right": `x=w-text_w-${Math.round(w * 0.05)}:y=${Math.round(h * 0.06)}`,
    "bottom-left": `x=${Math.round(w * 0.05)}:y=h-text_h-${Math.round(h * 0.08)}`,
    "bottom-right": `x=w-text_w-${Math.round(w * 0.05)}:y=h-text_h-${Math.round(h * 0.08)}`,
  };
  const pos = posMap[overlay.position] || posMap.bottom;

  // Escape text for FFmpeg
  const escapedText = overlay.text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");

  return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${color}:${pos}:borderw=2:bordercolor=black@0.6:shadowcolor=black@0.4:shadowx=2:shadowy=2`;
}

// ── Main render function ──

export async function renderToMP4(
  project: RenderProject,
  onProgress: ProgressCallback
): Promise<string> {
  const { w, h } = getDimensions(project.aspectRatio);

  const tasks: RenderTask[] = [
    { id: "ffmpeg-load", label: "Initialize FFmpeg", status: "working" },
    { id: "prepare", label: "Prepare Assets", status: "pending" },
    { id: "encode", label: "Encode Scenes", status: "pending" },
    { id: "concat", label: "Concatenate Video", status: "pending" },
    { id: "export", label: "Export MP4", status: "pending" },
  ];

  const emit = (updates?: Partial<RenderProgress>) => {
    const done = tasks.filter((t) => t.status === "done").length;
    onProgress({
      tasks: [...tasks],
      overallProgress: Math.round((done / tasks.length) * 100),
      project,
      ...updates,
    });
  };

  emit();

  try {
    // 1. Load FFmpeg WASM
    const ffmpeg = await getFFmpeg((msg) => {
      // Update encode task with FFmpeg log details
      const encodeTask = tasks.find((t) => t.id === "encode");
      if (encodeTask?.status === "working") {
        const timeMatch = msg.match(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);
        if (timeMatch) encodeTask.detail = `Time: ${timeMatch[1]}`;
      }
    });

    tasks[0].status = "done";
    tasks[0].detail = "WASM loaded";
    tasks[1].status = "working";
    tasks[1].detail = "Downloading assets...";
    emit();

    // 2. Prepare assets - write images and audio to FFmpeg virtual FS
    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i];

      // Write image
      tasks[1].detail = `Scene ${i + 1}/${project.scenes.length} image`;
      emit();

      const imgData = await fetchFile(scene.imageUrl);
      await ffmpeg.writeFile(`scene_${i}.jpg`, imgData);

      // Write audio if available
      if (scene.audioBase64) {
        const audioData = base64ToUint8Array(scene.audioBase64);
        await ffmpeg.writeFile(`audio_${i}.mp3`, audioData);
      }
    }

    tasks[1].status = "done";
    tasks[1].detail = `${project.scenes.length} scenes ready`;
    tasks[2].status = "working";
    tasks[2].detail = "Encoding scenes...";
    emit();

    // 3. Encode each scene as an individual MP4 clip
    const clipFiles: string[] = [];

    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i];
      const actualDuration = scene.duration / scene.speed;
      const clipName = `clip_${i}.mp4`;

      tasks[2].detail = `Scene ${i + 1}/${project.scenes.length}`;
      emit();

      // Build video filter chain
      let videoFilter = buildSceneFilter(scene, w, h, i);

      // Add text overlays
      for (const overlay of scene.textOverlays) {
        const textFilter = buildTextFilter(overlay, w, h);
        videoFilter += `,${textFilter}`;
      }

      // Build FFmpeg command
      const args: string[] = [];

      // Input: loop image for duration
      args.push("-loop", "1", "-t", actualDuration.toFixed(2), "-i", `scene_${i}.jpg`);

      // Input: audio if available
      if (scene.audioBase64) {
        args.push("-i", `audio_${i}.mp3`);
      }

      // Video filter
      args.push("-vf", videoFilter);

      // Encoding settings - H.264
      args.push(
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-r", "25",
        "-t", actualDuration.toFixed(2),
      );

      // Audio encoding
      if (scene.audioBase64) {
        args.push(
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
        );
      } else {
        // Generate silent audio track for concatenation compatibility
        args.push(
          "-f", "lavfi", "-t", actualDuration.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
        );
      }

      args.push("-y", clipName);

      await ffmpeg.exec(args);
      clipFiles.push(clipName);
    }

    tasks[2].status = "done";
    tasks[2].detail = `${clipFiles.length} clips encoded`;
    tasks[3].status = "working";
    tasks[3].detail = "Merging clips...";
    emit();

    // 4. Concatenate all clips
    if (clipFiles.length === 1) {
      // Single scene - just rename
      const data = await ffmpeg.readFile(clipFiles[0]);
      await ffmpeg.writeFile("output.mp4", data);
    } else {
      // Create concat list
      const concatList = clipFiles.map((f) => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("concat.txt", concatList);

      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", "output.mp4",
      ]);
    }

    tasks[3].status = "done";
    tasks[3].detail = "Merged";
    tasks[4].status = "working";
    tasks[4].detail = "Creating download...";
    emit();

    // 5. Read output and create blob URL
    const outputData = await ffmpeg.readFile("output.mp4");
    const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
    const videoUrl = URL.createObjectURL(blob);

    // Cleanup virtual FS
    for (let i = 0; i < project.scenes.length; i++) {
      try { await ffmpeg.deleteFile(`scene_${i}.jpg`); } catch {}
      try { await ffmpeg.deleteFile(`audio_${i}.mp3`); } catch {}
      try { await ffmpeg.deleteFile(`clip_${i}.mp4`); } catch {}
    }
    try { await ffmpeg.deleteFile("concat.txt"); } catch {}
    try { await ffmpeg.deleteFile("output.mp4"); } catch {}

    tasks[4].status = "done";
    tasks[4].detail = `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
    emit({ videoUrl });

    return videoUrl;
  } catch (e: any) {
    emit({ error: e.message });
    throw e;
  }
}
