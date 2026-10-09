import { useState, useEffect, useCallback } from "react";
import {
  Download, Film, Sparkles, ImageIcon, Volume2, Clapperboard,
  CheckCircle2, AlertCircle, Loader2, Clock, Package, ChevronDown, ChevronUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { runVideoPipeline, type PipelineState, type WorkerTask, type TaskStatus } from "@/lib/video-pipeline";

type Props = {
  topic: string;
  duration: number;
  aspectRatio: string;
};

const STATUS_ICON: Record<TaskStatus, typeof CheckCircle2> = {
  pending: Clock,
  working: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
};

const GROUP_ICON: Record<string, typeof Film> = {
  script: Sparkles,
  image: ImageIcon,
  voice: Volume2,
  render: Clapperboard,
  export: Package,
};

const GROUP_LABEL: Record<string, string> = {
  script: "Script",
  image: "Visuals",
  voice: "Voiceover",
  render: "Rendering",
  export: "Export",
};

const VideoGenerationCard = ({ topic, duration, aspectRatio }: Props) => {
  const [state, setState] = useState<PipelineState>({
    tasks: [],
    overallProgress: 0,
  });
  const [started, setStarted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["script"]));
  const [elapsed, setElapsed] = useState(0);

  const handleProgress = useCallback((s: PipelineState) => setState(s), []);

  useEffect(() => {
    if (started) return;
    setStarted(true);
    runVideoPipeline(topic, duration, aspectRatio, handleProgress).catch(() => {});
  }, [topic, duration, aspectRatio, handleProgress, started]);

  // Timer
  useEffect(() => {
    if (state.videoUrl || state.error) return;
    if (!started) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started, state.videoUrl, state.error]);

  // Auto-expand active groups
  useEffect(() => {
    const activeGroups = new Set<string>();
    state.tasks.forEach((t) => {
      if (t.status === "working") activeGroups.add(t.group);
    });
    if (activeGroups.size > 0) {
      setExpandedGroups((prev) => new Set([...prev, ...activeGroups]));
    }
  }, [state.tasks]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const { tasks, overallProgress, script, videoUrl, error } = state;

  // Group tasks
  const groups = ["script", "image", "voice", "render", "export"];
  const tasksByGroup: Record<string, WorkerTask[]> = {};
  groups.forEach((g) => {
    tasksByGroup[g] = tasks.filter((t) => t.group === g);
  });

  const isDone = !!videoUrl;
  const isError = !!error;
  const isWorking = started && !isDone && !isError;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const workingCount = tasks.filter((t) => t.status === "working").length;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${(script?.title || topic).replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
    a.click();
  };

  const getGroupStatus = (group: string): TaskStatus => {
    const gTasks = tasksByGroup[group];
    if (!gTasks || gTasks.length === 0) return "pending";
    if (gTasks.some((t) => t.status === "error")) return "error";
    if (gTasks.some((t) => t.status === "working")) return "working";
    if (gTasks.every((t) => t.status === "done")) return "done";
    return "pending";
  };

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Video Studio</span>
          <span className="ml-auto text-[11px] font-mono text-muted-foreground">
            {formatTime(elapsed)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{topic}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
            {duration}s
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
            {aspectRatio}
          </span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {doneCount}/{tasks.length} tasks
              {workingCount > 0 && ` • ${workingCount} active`}
            </span>
          )}
        </div>
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="relative bg-black">
          <video src={videoUrl} controls className="w-full max-h-[400px] object-contain" playsInline />
        </div>
      )}

      {/* Overall progress */}
      {isWorking && (
        <div className="px-4 pt-3">
          <Progress value={overallProgress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{overallProgress}%</p>
        </div>
      )}

      {/* Worker Groups */}
      <div className="px-2 py-2 space-y-0.5">
        {groups.map((group) => {
          const gTasks = tasksByGroup[group];
          if (!gTasks || gTasks.length === 0) return null;
          const groupStatus = getGroupStatus(group);
          const GroupIcon = GROUP_ICON[group];
          const StatusIcon = STATUS_ICON[groupStatus];
          const isExpanded = expandedGroups.has(group);
          const doneTasks = gTasks.filter((t) => t.status === "done").length;

          return (
            <div key={group} className="rounded-lg overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors rounded-lg"
              >
                <GroupIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1 text-left">
                  {GROUP_LABEL[group]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {doneTasks}/{gTasks.length}
                </span>
                <StatusIcon
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    groupStatus === "done" && "text-emerald-500",
                    groupStatus === "working" && "text-blue-500 animate-spin",
                    groupStatus === "error" && "text-destructive",
                    groupStatus === "pending" && "text-muted-foreground/50",
                  )}
                />
                {gTasks.length > 1 && (
                  isExpanded
                    ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                )}
              </button>

              {/* Individual tasks */}
              {isExpanded && gTasks.length > 1 && (
                <div className="ml-5 mr-2 mb-1 space-y-px">
                  {gTasks.map((task) => {
                    const TIcon = STATUS_ICON[task.status];
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                          task.status === "working" && "bg-blue-500/5",
                        )}
                      >
                        <TIcon
                          className={cn(
                            "w-3 h-3 shrink-0",
                            task.status === "done" && "text-emerald-500",
                            task.status === "working" && "text-blue-500 animate-spin",
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
                          <span
                            className={cn(
                              "text-[10px] shrink-0",
                              task.status === "error" ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {task.detail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          {error}
        </div>
      )}

      {/* Done state */}
      {isDone && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Video ready in {formatTime(elapsed)}
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

export default VideoGenerationCard;
