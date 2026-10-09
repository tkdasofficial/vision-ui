import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle, ChevronDown, ChevronUp, Image, FileText, Code2, Mic, Video, MessageSquare, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AgentPlan, AgentStep, StepResult, StepStatus } from "@/lib/agent-executor";
import { executeAgentPlan } from "@/lib/agent-executor";
import FileCreatorCard from "./FileCreatorCard";
import WebAppPreviewCard from "./WebAppPreviewCard";

type Props = {
  plan: AgentPlan;
  onComplete?: (results: Map<number, StepResult>) => void;
};

const TOOL_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare,
  "image-generator": Image,
  "file-creator": FileText,
  "code-generator": Code2,
  tts: Mic,
  "video-generator": Video,
};

const STATUS_ICONS: Record<StepStatus, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-primary",
  done: "text-green-500",
  error: "text-destructive",
};

export default function AgentProgressCard({ plan, onComplete }: Props) {
  const [stepStatuses, setStepStatuses] = useState<Map<number, StepResult>>(new Map());
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);

    executeAgentPlan(plan, (stepId, result) => {
      setStepStatuses((prev) => {
        const next = new Map(prev);
        next.set(stepId, { ...prev.get(stepId), ...result } as StepResult);
        return next;
      });
    }).then((results) => {
      clearInterval(timer);
      setIsRunning(false);
      onComplete?.(results);
    });

    return () => clearInterval(timer);
  }, [plan, onComplete]);

  const getStatus = (stepId: number): StepStatus => stepStatuses.get(stepId)?.status || "pending";

  const completedCount = plan.steps.filter((s) => getStatus(s.id) === "done").length;
  const progress = plan.steps.length > 0 ? (completedCount / plan.steps.length) * 100 : 0;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{plan.title}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{completedCount}/{plan.steps.length} steps</span>
            <span>{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {plan.steps.map((step) => {
          const status = getStatus(step.id);
          const result = stepStatuses.get(step.id);
          const StatusIcon = STATUS_ICONS[status];
          const ToolIcon = TOOL_ICONS[step.tool] || MessageSquare;
          const isExpanded = expandedStep === step.id;
          const hasContent = result?.output || result?.imageUrl || result?.generatedFile || result?.webApp || result?.error;

          return (
            <div key={step.id} className="group">
              <button
                onClick={() => hasContent && setExpandedStep(isExpanded ? null : step.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                disabled={!hasContent}
              >
                <StatusIcon
                  className={`w-4 h-4 flex-shrink-0 ${STATUS_COLORS[status]} ${status === "running" ? "animate-spin" : ""}`}
                />
                <ToolIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className={`text-sm flex-1 ${status === "done" ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {hasContent && (
                  isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && hasContent && (
                <div className="px-4 pb-3 pl-12">
                  {result?.error && (
                    <p className="text-sm text-destructive">{result.error}</p>
                  )}

                  {result?.imageUrl && (
                    <img
                      src={result.imageUrl}
                      alt={step.label}
                      className="rounded-lg max-w-sm mt-1 border border-border"
                    />
                  )}

                  {result?.generatedFile && (
                    <FileCreatorCard file={result.generatedFile} />
                  )}

                  {result?.webApp && (
                    <WebAppPreviewCard project={result.webApp} />
                  )}

                  {result?.output && !result?.imageUrl && !result?.generatedFile && !result?.webApp && (
                    <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-h-60 overflow-y-auto">
                      <ReactMarkdown>{result.output.length > 2000 ? result.output.slice(0, 2000) + "..." : result.output}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!isRunning && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            {completedCount === plan.steps.length
              ? "✅ All steps completed successfully"
              : `⚠️ ${plan.steps.length - completedCount} step(s) had issues`}
          </p>
        </div>
      )}
    </div>
  );
}
