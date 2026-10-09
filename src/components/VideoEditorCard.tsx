import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download, Film, Sparkles, ImageIcon, Volume2, Clapperboard,
  CheckCircle2, AlertCircle, Loader2, Clock, ChevronDown, ChevronUp,
  Scissors,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  type VideoProject, type EditorProgress, type EditorTask, type EditorTaskStatus,
  applyOperations, renderProject,
} from "@/lib/video-editor-engine";
import { runVideoPipeline, type PipelineState, type WorkerTask, type TaskStatus } from "@/lib/video-pipeline";
import { runLongFormPipeline, type LongFormPipelineState } from "@/lib/long-form-pipeline";
import type { RenderScene } from "@/lib/ffmpeg-renderer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

type EditorCardProps = {
  userMessage: string;
  existingProject?: VideoProject;
  onProjectUpdate?: (project: VideoProject) => void;
  onVideoReady?: (url: string) => void;
};

type Phase = "analyzing" | "planning" | "generating" | "editing" | "rendering" | "done" | "error";

const PHASE_CONFIG: Record<Phase, { icon: typeof Film; label: string }> = {
  analyzing: { icon: Sparkles, label: "Analyzing Request" },
  planning: { icon: Scissors, label: "Planning Edits" },
  generating: { icon: ImageIcon, label: "Generating Assets" },
  editing: { icon: Scissors, label: "Applying Edits" },
  rendering: { icon: Clapperboard, label: "Rendering" },
  done: { icon: CheckCircle2, label: "Complete" },
  error: { icon: AlertCircle, label: "Failed" },
};

const STATUS_ICON: Record<EditorTaskStatus | TaskStatus, typeof CheckCircle2> = {
  pending: Clock,
  working: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
};

// ── Component ──

const VideoEditorCard = ({ userMessage, existingProject, onProjectUpdate, onVideoReady }: EditorCardProps) => {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [tasks, setTasks] = useState<(EditorTask | WorkerTask)[]>([
    { id: "ai-decide", label: "AI Decision", status: "working" },
  ]);
  const [explanation, setExplanation] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandTasks, setExpandTasks] = useState(true);
  const started = useRef(false);

  // Timer
  useEffect(() => {
    if (phase === "done" || phase === "error") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const updateTask = useCallback((id: string, status: EditorTaskStatus, detail?: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, detail } : t)));
  }, []);

  const addTask = useCallback((task: EditorTask) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  // ── Main execution ──
  const execute = useCallback(async () => {
    try {
      // 1. Call AI editor to decide what to do
      setPhase("analyzing");

      const projectState = existingProject
        ? {
            title: existingProject.title,
            aspectRatio: existingProject.aspectRatio,
            sceneCount: existingProject.scenes.length,
            scenes: existingProject.scenes.map((s, i) => ({
              index: i,
              narration: s.narration,
              duration: s.duration,
              filters: s.filters,
              textOverlays: s.textOverlays.length,
              speed: s.speed,
              transition: s.transition,
            })),
          }
        : null;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/video-editor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMessage }],
          projectState,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI editor failed");

      updateTask("ai-decide", "done", "Decision made");

      const toolCalls = data.toolCalls || [];
      const aiText = data.text || "";

      if (toolCalls.length === 0) {
        setExplanation(aiText || "No changes needed.");
        setPhase("done");
        return;
      }

      // 2. Process tool calls
      for (const call of toolCalls) {
        if (call.name === "generate_full_video") {
          await handleGenerateVideo(call.arguments);
        } else if (call.name === "generate_long_form_video") {
          await handleLongFormVideo(call.arguments);
        } else if (call.name === "edit_video") {
          await handleEditVideo(call.arguments);
        } else if (call.name === "analyze_visuals") {
          await handleAnalyzeVisuals(call.arguments);
        } else if (call.name === "analyze_video") {
          setExplanation(call.arguments.summary || "Analysis complete.");
          setPhase("done");
        }
      }
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }, [userMessage, existingProject, updateTask]);

  // ── Generate full video via server-side pipeline ──
  const handleGenerateVideo = async (args: any) => {
    setPhase("generating");
    const { topic, duration, aspect_ratio } = args;

    try {
      const url = await runVideoPipeline(
        topic,
        duration || 45,
        aspect_ratio || "9:16",
        (state: PipelineState) => {
          // Merge pipeline tasks into our task list
          setTasks((prev) => {
            const aiTask = prev.find((t) => t.id === "ai-decide");
            return [aiTask!, ...state.tasks];
          });

          if (state.script) {
            setExplanation(`Creating "${state.script.title}" with ${state.script.scenes.length} scenes`);
          }

          if (state.videoUrl) {
            setVideoUrl(state.videoUrl);
            onVideoReady?.(state.videoUrl);
            setPhase("done");
          }

          if (state.error) {
            setError(state.error);
            setPhase("error");
          }
        }
      );

      if (!videoUrl) {
        setVideoUrl(url);
        onVideoReady?.(url);
        setPhase("done");
      }
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  };

  // ── Generate long-form video via stock footage pipeline ──
  const handleLongFormVideo = async (args: any) => {
    setPhase("generating");
    const { topic, duration, aspect_ratio } = args;

    try {
      const url = await runLongFormPipeline(
        topic,
        duration || 120,
        aspect_ratio || "16:9",
        (state: LongFormPipelineState) => {
          setTasks((prev) => {
            const aiTask = prev.find((t) => t.id === "ai-decide");
            return [aiTask!, ...state.tasks];
          });

          if (state.script) {
            const chapterInfo = state.chapters?.map((c) => c.title).join(", ") || "";
            setExplanation(`Creating "${state.script.title}" with ${state.script.totalScenes} scenes across ${state.script.chapters.length} chapters${chapterInfo ? `: ${chapterInfo}` : ""}`);
          }

          if (state.videoUrl) {
            setVideoUrl(state.videoUrl);
            onVideoReady?.(state.videoUrl);
            setPhase("done");
          }

          if (state.error) {
            setError(state.error);
            setPhase("error");
          }
        }
      );

      if (!videoUrl) {
        setVideoUrl(url);
        onVideoReady?.(url);
        setPhase("done");
      }
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  };

  // ── Run visual analysis ──
  const handleAnalyzeVisuals = async (args: any) => {
    if (!existingProject) {
      throw new Error("No video project to analyze. Create a video first.");
    }

    setPhase("analyzing");
    addTask({ id: "visual-analysis", label: "Visual Analysis", status: "working" });

    const analysisScenes = existingProject.scenes.map((s, i) => ({
      index: i,
      imageUrl: s.imageUrl,
      narration: s.narration,
      duration: s.duration,
    }));

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/visual-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        scenes: analysisScenes,
        aspectRatio: existingProject.aspectRatio,
        contentType: existingProject.scenes.length > 8 ? "long" : "short",
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Visual analysis failed");
    }

    const analysis = await resp.json();
    updateTask("visual-analysis", "done", `Score: ${analysis.overallScore}/100`);

    const issueCount = analysis.issues?.length || 0;
    const criticalCount = analysis.issues?.filter((i: any) => i.severity === "critical").length || 0;

    setExplanation(
      `${analysis.summary}\n\nScores: Overall ${analysis.overallScore}/100, Consistency ${analysis.consistencyScore}/100, Quality ${analysis.qualityScore}/100, Pacing ${analysis.pacingScore}/100.\n${issueCount} issues found (${criticalCount} critical).${analysis.recommendations?.length ? "\n\nRecommendations:\n" + analysis.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n") : ""}`
    );
    setPhase("done");
  };

  // ── Apply edits via server-side ──
  const handleEditVideo = async (args: any) => {
    if (!existingProject) {
      throw new Error("No video project to edit. Create a video first.");
    }

    setPhase("editing");
    setExplanation(args.explanation || "Applying edits...");

    const operations = args.operations || [];

    // Handle regeneration ops via server
    const regenOps = operations.filter((op: any) =>
      op.type === "regenerate_image" || op.type === "regenerate_voice"
    );

    if (regenOps.length > 0) {
      for (const op of regenOps) {
        addTask({
          id: `regen-${op.type}-${op.sceneIndex ?? 0}`,
          label: `Regenerate Scene ${(op.sceneIndex ?? 0) + 1}`,
          status: "working",
        });
      }

      // Send regeneration to server
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/video-render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          action: "edit",
          editOps: regenOps,
          projectState: { aspectRatio: existingProject.aspectRatio },
        }),
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(line.slice(6).trim());
              if (event.type === "task_update") {
                const existing = tasks.find((t) => t.id === event.id);
                if (existing) {
                  updateTask(event.id, event.status, event.detail);
                }
              }
              if (event.type === "edit_complete") {
                // Apply results back to project
                for (const op of event.operations) {
                  if (op._result) {
                    const sceneIdx = op.sceneIndex ?? 0;
                    if (op._result.imageUrl) existingProject.scenes[sceneIdx].imageUrl = op._result.imageUrl;
                    if (op._result.audioBase64) existingProject.scenes[sceneIdx].audioBase64 = op._result.audioBase64;
                  }
                }
              }
            } catch {}
          }
        }
      }
    }

    // Apply non-API operations locally
    const nonApiOps = operations.filter((op: any) =>
      op.type !== "regenerate_image" && op.type !== "regenerate_voice"
    );
    const updatedProject = applyOperations(existingProject, nonApiOps);
    onProjectUpdate?.(updatedProject);

    // Render via native WebM assembler
    setPhase("rendering");
    const url = await renderProject(updatedProject, (progress) => {
      setTasks((prev) => {
        const nonRender = prev.filter((t) => !t.id.startsWith("assemble") && t.id !== "export");
        return [...nonRender, ...progress.tasks];
      });
    });

    setVideoUrl(url);
    onVideoReady?.(url);
    setPhase("done");
  };

  // Start execution
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    execute();
  }, [execute]);

  // ── Render UI ──

  const phaseConfig = PHASE_CONFIG[phase];
  const PhaseIcon = phaseConfig.icon;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `video_${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">AI Video Editor</span>
          <span className="ml-auto text-[11px] font-mono text-muted-foreground">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {phase === "done" || phase === "error" ? (
            <PhaseIcon className={cn("w-3.5 h-3.5", phase === "done" ? "text-emerald-500" : "text-destructive")} />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-foreground animate-spin" />
          )}
          <span className="text-xs font-medium text-foreground">{phaseConfig.label}</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto">{doneCount}/{tasks.length}</span>
          )}
        </div>
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="relative bg-black">
          <video src={videoUrl} controls className="w-full max-h-[400px] object-contain" playsInline />
        </div>
      )}

      {/* Progress */}
      {phase !== "done" && phase !== "error" && tasks.length > 0 && (
        <div className="px-4 pt-3">
          <Progress value={Math.round((doneCount / tasks.length) * 100)} className="h-1.5" />
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="px-4 pt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="px-2 py-2">
          <button
            onClick={() => setExpandTasks(!expandTasks)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground flex-1 text-left">Tasks</span>
            <span className="text-[10px] text-muted-foreground">{doneCount}/{tasks.length}</span>
            {expandTasks ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </button>

          {expandTasks && (
            <div className="ml-3 mr-2 mt-1 space-y-px max-h-[200px] overflow-y-auto">
              {tasks.map((task) => {
                const TIcon = STATUS_ICON[task.status];
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                      task.status === "working" && "bg-accent/40",
                    )}
                  >
                    <TIcon
                      className={cn(
                        "w-3 h-3 shrink-0",
                        task.status === "done" && "text-emerald-500",
                        task.status === "working" && "text-foreground animate-spin",
                        task.status === "error" && "text-destructive",
                        task.status === "pending" && "text-muted-foreground/40",
                      )}
                    />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        task.status === "pending" && "text-muted-foreground/60",
                        task.status === "working" && "text-foreground font-medium",
                        task.status === "done" && "text-muted-foreground",
                        task.status === "error" && "text-destructive",
                      )}
                    >
                      {task.label}
                    </span>
                    {task.detail && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{task.detail}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          {error}
        </div>
      )}

      {/* Done */}
      {phase === "done" && videoUrl && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Rendered in {formatTime(elapsed)}
            </span>
          </div>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Download MP4
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoEditorCard;
