/**
 * Native WebM video assembler using Canvas + MediaRecorder.
 * Zero external dependencies — uses browser-native APIs only.
 * All heavy asset generation is done server-side; this only handles final assembly.
 */

export type AssemblyScene = {
  imageUrl: string;
  audioBase64: string; // base64 MP3
  duration: number;
  narration: string;
  transition: string;
  filters: string[];
  textOverlays: { text: string; position: string; fontSize: number; fontColor: string }[];
  speed: number;
  zoom?: { start: number; end: number };
};

export type AssemblyProject = {
  title: string;
  scenes: AssemblyScene[];
  aspectRatio: string;
};

type AssemblyCallback = (progress: {
  stage: string;
  sceneIndex?: number;
  totalScenes: number;
  percent: number;
}) => void;

// ── Dimensions ──

function getDimensions(ar: string): { w: number; h: number } {
  const map: Record<string, [number, number]> = {
    "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [720, 720],
    "4:3": [960, 720], "4:5": [720, 900], "3:4": [720, 960],
  };
  const [w, h] = map[ar] || [720, 1280];
  return { w, h };
}

// ── Load image ──

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

// ── Decode audio ──

async function decodeAudio(base64: string): Promise<AudioBuffer | null> {
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(bytes.buffer);
    return buffer;
  } catch {
    return null;
  }
}

// ── Draw scene frame ──

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scene: AssemblyScene,
  w: number,
  h: number,
  time: number,
  duration: number
) {
  // Background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // Calculate zoom
  let zoom = 1;
  if (scene.zoom) {
    const t = duration > 0 ? time / duration : 0;
    zoom = scene.zoom.start + (scene.zoom.end - scene.zoom.start) * t;
  }

  // Draw image with cover fit + zoom
  const imgAR = img.width / img.height;
  const canvasAR = w / h;
  let sw: number, sh: number, sx: number, sy: number;

  if (imgAR > canvasAR) {
    sh = img.height;
    sw = sh * canvasAR;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / canvasAR;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();

  // Apply CSS-like filters
  if (scene.filters.length > 0) {
    const filterMap: Record<string, () => void> = {
      darken: () => { ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(0, 0, w, h); },
      brighten: () => { ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(0, 0, w, h); },
      warm: () => { ctx.fillStyle = "rgba(255,150,50,0.08)"; ctx.fillRect(0, 0, w, h); },
      cool: () => { ctx.fillStyle = "rgba(50,100,255,0.08)"; ctx.fillRect(0, 0, w, h); },
      vintage: () => { ctx.fillStyle = "rgba(200,150,80,0.12)"; ctx.fillRect(0, 0, w, h); },
      cinematic: () => {
        ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(0, 0, w, h);
        // Letterbox bars
        const barH = h * 0.06;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, barH);
        ctx.fillRect(0, h - barH, w, barH);
      },
      noir: () => {
        // Desaturate via grayscale overlay
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, 0, w, h);
      },
    };
    for (const f of scene.filters) {
      filterMap[f]?.();
    }
  }

  // Text overlays
  for (const overlay of scene.textOverlays) {
    const fontSize = overlay.fontSize || Math.round(h * 0.05);
    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";

    const posMap: Record<string, { x: number; y: number }> = {
      top: { x: w / 2, y: fontSize + h * 0.05 },
      center: { x: w / 2, y: h / 2 },
      bottom: { x: w / 2, y: h - h * 0.08 },
      "top-left": { x: w * 0.15, y: fontSize + h * 0.05 },
      "top-right": { x: w * 0.85, y: fontSize + h * 0.05 },
      "bottom-left": { x: w * 0.15, y: h - h * 0.08 },
      "bottom-right": { x: w * 0.85, y: h - h * 0.08 },
    };
    const pos = posMap[overlay.position] || posMap.bottom;

    // Shadow
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = fontSize * 0.08;
    ctx.strokeText(overlay.text, pos.x, pos.y);
    // Text
    ctx.fillStyle = overlay.fontColor || "white";
    ctx.fillText(overlay.text, pos.x, pos.y);
  }

  // Fade transitions
  if (scene.transition === "fade") {
    const fadeTime = 0.3;
    if (time < fadeTime) {
      const alpha = 1 - time / fadeTime;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (time > duration - fadeTime) {
      const alpha = (time - (duration - fadeTime)) / fadeTime;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

// ── Assemble WebM ──

export async function assembleWebM(
  project: AssemblyProject,
  onProgress: AssemblyCallback
): Promise<Blob> {
  const { w, h } = getDimensions(project.aspectRatio);
  const fps = 30;

  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Load all images upfront
  onProgress({ stage: "Loading assets", totalScenes: project.scenes.length, percent: 5 });

  const images: HTMLImageElement[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const img = await loadImage(project.scenes[i].imageUrl);
    images.push(img);
    onProgress({
      stage: "Loading assets",
      sceneIndex: i,
      totalScenes: project.scenes.length,
      percent: 5 + Math.round((i / project.scenes.length) * 15),
    });
  }

  // Decode all audio
  const audioBuffers: (AudioBuffer | null)[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const buf = await decodeAudio(project.scenes[i].audioBase64);
    audioBuffers.push(buf);
  }

  // Create audio context for mixing
  const audioCtx = new AudioContext();

  // Calculate total duration
  const totalDuration = project.scenes.reduce((sum, s) => sum + s.duration / s.speed, 0);
  const totalFrames = Math.ceil(totalDuration * fps);

  // Set up MediaRecorder with canvas stream
  const stream = canvas.captureStream(fps);

  // Create a destination for audio mixing
  const audioDest = audioCtx.createMediaStreamDestination();
  const audioTrack = audioDest.stream.getAudioTracks()[0];
  if (audioTrack) {
    stream.addTrack(audioTrack);
  }

  // Schedule all audio playback
  let audioOffset = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    const buf = audioBuffers[i];
    if (buf) {
      const source = audioCtx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = project.scenes[i].speed;
      source.connect(audioDest);
      source.start(audioCtx.currentTime + audioOffset);
    }
    audioOffset += project.scenes[i].duration / project.scenes[i].speed;
  }

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 4_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };

    recorder.onerror = (e) => reject(new Error("Recording failed"));

    recorder.start(100); // collect chunks every 100ms

    // Render frames
    let frame = 0;
    let currentScene = 0;
    let sceneFrameStart = 0;

    const renderLoop = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        audioCtx.close();
        return;
      }

      const globalTime = frame / fps;

      // Find current scene
      let elapsed = 0;
      for (let i = 0; i < project.scenes.length; i++) {
        const sceneDur = project.scenes[i].duration / project.scenes[i].speed;
        if (globalTime < elapsed + sceneDur) {
          currentScene = i;
          break;
        }
        elapsed += sceneDur;
      }

      const scene = project.scenes[currentScene];
      const sceneDur = scene.duration / scene.speed;
      const sceneTime = globalTime - elapsed;

      drawFrame(ctx, images[currentScene], scene, w, h, sceneTime, sceneDur);

      frame++;

      // Progress
      if (frame % fps === 0) {
        onProgress({
          stage: `Rendering scene ${currentScene + 1}/${project.scenes.length}`,
          sceneIndex: currentScene,
          totalScenes: project.scenes.length,
          percent: 20 + Math.round((frame / totalFrames) * 75),
        });
      }

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(renderLoop);
    };

    onProgress({ stage: "Rendering", totalScenes: project.scenes.length, percent: 20 });
    renderLoop();
  });
}
