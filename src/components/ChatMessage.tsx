import { useState, useCallback, useEffect, useRef, useMemo, forwardRef } from "react";
import type { ChatMessage as ChatMessageType, StockVideo } from "@/lib/types";
import {
  Copy,
  Check,
  Play,
  ExternalLink,
  Download,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  FileCode,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Components } from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import VideoGenerationCard from "./VideoGenerationCard";
import VideoEditorCard from "./VideoEditorCard";
import WebAppPreviewCard from "./WebAppPreviewCard";
import ZipAnalysisCard from "./ZipAnalysisCard";
import FileConverterCard from "./FileConverterCard";
import TTSCard from "./TTSCard";
import FileCreatorCard from "./FileCreatorCard";
import AgentProgressCard from "./AgentProgressCard";
import StoryFlowCard from "./story/StoryFlowCard";

type Props = { message: ChatMessageType; isNew?: boolean };

const getMessageSize = (content: string) => {
  if (content.length < 60) return "short";
  if (content.length < 200) return "medium";
  return "long";
};

const proseClasses = [
  "[&_p]:leading-[1.7] [&_p]:mb-2.5",
  "[&_li]:leading-[1.7]",
  "[&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2",
  "[&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
  "[&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
  "[&_strong]:text-foreground [&_strong]:font-semibold",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary",
  "[&_code]:bg-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[13px] [&_code]:font-mono",
  /* pre/code blocks handled by custom CodeBlock component */
  "[&_pre]:my-0",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px]",
  "[&_blockquote]:border-l-[3px] [&_blockquote]:border-foreground/15 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3 [&_blockquote]:bg-accent/50 [&_blockquote]:rounded-r-lg [&_blockquote]:pr-3",
  "[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border",
  "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-accent [&_th]:text-xs [&_th]:font-semibold [&_th]:text-left [&_th]:uppercase [&_th]:tracking-wider",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm",
  "[&_tr:hover]:bg-accent/30",
  "[&_ul]:space-y-1.5 [&_ul]:my-2 [&_ul]:pl-1",
  "[&_ol]:space-y-1.5 [&_ol]:my-2 [&_ol]:pl-1",
  "[&_li]:pl-1",
  "[&_hr]:border-border [&_hr]:my-4",
].join(" ");

/* ── Code block with copy button ── */
const CodeBlock = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-accent overflow-hidden my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <div className="flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            {lang || "code"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-[13px] font-mono bg-transparent p-0">{code}</code>
      </pre>
    </div>
  );
};

/* Custom markdown components with code block copy */
const mdComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ children, className, ...props }: any) => {
    const isBlock = className?.startsWith("language-") || String(children).includes("\n");
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return (
      <code className="bg-accent px-1.5 py-0.5 rounded-md text-[13px] font-mono" {...props}>
        {children}
      </code>
    );
  },
};

/* ── Copy button for task card ── */
const CardCopyButton = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/80 bg-accent border border-border transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const NORMAL_CPS = 50;
const TASK_CPS = 180;

/* ── Content splitter ──
   Splits AI content into segments: [text, task, text]
   "task" = the main structured body (story, code, blog, list, etc.)
   Intro/outro are the short plain text before/after.
*/
type Segment = { type: "text" | "task"; content: string };

const splitContent = (raw: string): Segment[] => {
  const lines = raw.split("\n");
  const totalLen = raw.length;

  // Short messages → all text, no card
  if (totalLen < 250) return [{ type: "text", content: raw }];

  // Find where "task" body starts: first heading, code fence, numbered list, or bold line after intro
  let taskStart = -1;
  let taskEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (taskStart === -1) {
      // Detect task body start
      if (
        /^#{1,3}\s/.test(l) ||
        /^```/.test(l) ||
        /^\d+\.\s/.test(l) ||
        /^\*\*[^*]+\*\*/.test(l) ||
        /^[-*]\s/.test(l)
      ) {
        // Only treat as task if there's enough content after
        const remaining = lines.slice(i).join("\n").length;
        if (remaining > 150) {
          taskStart = i;
        }
      }
    }
  }

  // No task body found → plain text
  if (taskStart === -1) return [{ type: "text", content: raw }];

  // Find task end: scan from bottom for a short plain closing paragraph
  for (let i = lines.length - 1; i > taskStart; i--) {
    const l = lines[i].trim();
    if (l === "") continue;
    // If the last non-empty lines are short plain text (no markdown markers), they're the outro
    if (
      !/^#{1,3}\s/.test(l) &&
      !/^```/.test(l) &&
      !/^\d+\.\s/.test(l) &&
      !/^[-*]\s/.test(l) &&
      !/^\*\*/.test(l) &&
      l.length < 200
    ) {
      // Check if this is truly a closing remark (short paragraph block)
      let outroStart = i;
      // Walk up to find the start of the outro block (consecutive short plain lines)
      for (let j = i - 1; j > taskStart; j--) {
        const lj = lines[j].trim();
        if (lj === "") {
          outroStart = j + 1;
          break;
        }
        if (
          /^#{1,3}\s/.test(lj) ||
          /^```/.test(lj) ||
          /^\d+\.\s/.test(lj) ||
          /^[-*]\s/.test(lj) ||
          /^\*\*/.test(lj)
        ) {
          outroStart = j + 1;
          break;
        }
        outroStart = j;
      }
      const outroText = lines.slice(outroStart).join("\n").trim();
      if (outroText.length > 0 && outroText.length < 300) {
        taskEnd = outroStart;
      }
      break;
    } else {
      break; // last content is structured → no outro
    }
  }

  const segments: Segment[] = [];
  const preText = lines.slice(0, taskStart).join("\n").trim();
  const taskText = lines.slice(taskStart, taskEnd).join("\n").trim();
  const postText = lines.slice(taskEnd).join("\n").trim();

  if (preText) segments.push({ type: "text", content: preText });
  if (taskText) segments.push({ type: "task", content: taskText });
  if (postText) segments.push({ type: "text", content: postText });

  return segments.length > 0 ? segments : [{ type: "text", content: raw }];
};

/* ── Multi-segment typewriter ──
   Animates segments sequentially: text@50cps → task@200cps → text@50cps
*/
const useSegmentedTypewriter = (segments: Segment[], enabled: boolean) => {
  const [charCounts, setCharCounts] = useState<number[]>(() =>
    enabled ? segments.map(() => 0) : segments.map((s) => s.content.length),
  );
  const [allDone, setAllDone] = useState(!enabled);
  const rafRef = useRef(0);
  const startRef = useRef(0);

  // Precompute timing: each segment starts after the previous finishes
  const timing = useMemo(() => {
    let offset = 0;
    return segments.map((s) => {
      const cps = s.type === "task" ? TASK_CPS : NORMAL_CPS;
      const duration = s.content.length / cps;
      const start = offset;
      offset += duration;
      return { cps, duration, start, len: s.content.length };
    });
  }, [segments]);

  useEffect(() => {
    if (!enabled) {
      setCharCounts(segments.map((s) => s.content.length));
      setAllDone(true);
      return;
    }
    setCharCounts(segments.map(() => 0));
    setAllDone(false);
    startRef.current = performance.now();

    const totalDuration = timing.reduce((a, t) => a + t.duration, 0);

    const animate = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const counts = timing.map((t) => {
        if (elapsed < t.start) return 0;
        const segElapsed = elapsed - t.start;
        return Math.min(Math.floor(segElapsed * t.cps), t.len);
      });
      setCharCounts(counts);
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCharCounts(segments.map((s) => s.content.length));
        setAllDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [segments, enabled, timing]);

  return { charCounts, allDone };
};

const ChatMessage = forwardRef<HTMLDivElement, Props>(({ message, isNew = false }, ref) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [reported, setReported] = useState(false);
  const { toast } = useToast();
  const mountedRef = useRef(false);

  // Animate on first mount for new AI messages only
  const shouldAnimate = isNew && !isUser && !mountedRef.current;
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  const segments = useMemo(() => splitContent(message.content), [message.content]);
  const { charCounts, allDone: typingDone } = useSegmentedTypewriter(segments, shouldAnimate);

  const size = getMessageSize(message.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      toast({
        title: "Not supported",
        description: "Text-to-speech is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }
    const plainText = message.content
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>\-|]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, ". ")
      .trim();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [speaking, message.content, toast]);

  const handleFeedback = (type: "up" | "down") => {
    setFeedback((prev) => (prev === type ? null : type));
    toast({
      title: type === "up" ? "Thanks for the feedback!" : "We'll improve",
      description: type === "up" ? "Glad this was helpful." : "Sorry about that. We'll work on it.",
    });
  };

  const handleReport = () => {
    setReported(true);
    toast({ title: "Reported", description: "This response has been flagged for review." });
  };

  // Find which segment is currently animating (for cursor placement)
  const activeSegIdx =
    shouldAnimate && !typingDone
      ? charCounts.findIndex((c, i) => c < segments[i].content.length)
      : -1;

  return (
    <div
      ref={ref}
      className={cn(
        "px-4 sm:px-6 w-full max-w-3xl mx-auto transition-all duration-300",
        isUser ? "py-2" : "pt-3 pb-4",
        isNew && "animate-fade-in",
      )}
    >
      {isUser ? (
        <Message from="user" className="max-w-full">
          <MessageContent
            className={cn(
              "relative group-[.is-user]:rounded-[20px] group-[.is-user]:bg-chat-user group-[.is-user]:text-chat-user-foreground transition-all duration-200",
              size === "short" &&
                "group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 text-ui-label max-w-[80%] sm:max-w-[75%]",
              size === "medium" &&
                "group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 text-ui-label max-w-[85%] sm:max-w-[82%]",
              size === "long" &&
                "group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 text-ui-label max-w-[92%] sm:max-w-[88%] leading-relaxed",
            )}
          >
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Attached"
                className="w-28 sm:w-36 h-28 sm:h-36 rounded-xl object-cover mb-2.5 border border-background/10"
              />
            )}
            <p className="leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          </MessageContent>
        </Message>
      ) : (
        <div className="group relative max-w-full">
          <div className="space-y-3">
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Generated"
                className="max-w-xs sm:max-w-sm w-full rounded-xl border border-border shadow-sm"
              />
            )}

            {message.content && (
              <Message from="assistant" className="max-w-full">
                <MessageResponse
                  className={cn("text-ui-label leading-6 break-words", proseClasses)}
                  isAnimating={shouldAnimate && !typingDone}
                >
                  {segments
                    .map((segment, index) =>
                      segment.content.slice(0, charCounts[index] ?? segment.content.length),
                    )
                    .join("\n\n")}
                </MessageResponse>
              </Message>
            )}

            {message.videos && message.videos.length > 0 && <VideoGrid videos={message.videos} />}
            {message.videoGeneration && (
              <VideoGenerationCard
                topic={message.videoGeneration.topic}
                duration={message.videoGeneration.duration}
                aspectRatio={message.videoGeneration.aspectRatio}
              />
            )}
            {message.videoEdit && <VideoEditorCard userMessage={message.videoEdit.userMessage} />}
            {message.webApp && <WebAppPreviewCard project={message.webApp} />}
            {message.zipAnalysis && <ZipAnalysisCard analysis={message.zipAnalysis} />}
            {message.convertFile && <FileConverterCard file={message.convertFile} />}
            {message.ttsScript && <TTSCard script={message.ttsScript} />}
            {message.generatedFile && <FileCreatorCard file={message.generatedFile} />}
            {message.agentPlan && <AgentProgressCard plan={message.agentPlan} />}
            {message.story && (
              <StoryFlowCard
                projectId={message.story.projectId}
                initialPrompt={message.story.initialPrompt}
              />
            )}

            {/* Action bar */}
            {message.content && typingDone && (
              <div className="-ml-2 flex items-center gap-0 pt-1">
                <ActionButton onClick={handleCopy} active={copied} title="Copy">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </ActionButton>
                <ActionButton
                  onClick={() => handleFeedback("up")}
                  active={feedback === "up"}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </ActionButton>
                <ActionButton
                  onClick={() => handleFeedback("down")}
                  active={feedback === "down"}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </ActionButton>
                <ActionButton
                  onClick={handleSpeak}
                  active={speaking}
                  title={speaking ? "Stop listening" : "Listen"}
                >
                  {speaking ? <VolumeX /> : <Volume2 />}
                </ActionButton>
                <ActionButton
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({ text: message.content });
                      } catch {
                        /* Dismissing sharing needs no error. */
                      }
                    } else {
                      handleCopy();
                    }
                  }}
                  title="Share"
                >
                  <Share2 />
                </ActionButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More response actions"
                      title="More response actions"
                      className="size-8 rounded-full text-muted-foreground [&_svg]:size-4"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem disabled={reported} onClick={handleReport}>
                      Report response
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
ChatMessage.displayName = "ChatMessage";
/** Reusable small icon button for action bar */
const ActionButton = ({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) => (
  <MessageAction
    onClick={onClick}
    disabled={disabled}
    tooltip={title}
    label={title}
    className={cn(
      "size-8 rounded-full transition-colors [&_svg]:size-4 [&_svg]:stroke-[1.8]",
      active
        ? "text-foreground bg-accent"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
      disabled && "opacity-50 cursor-not-allowed",
    )}
  >
    {children}
  </MessageAction>
);

const VideoGrid = ({ videos }: { videos: StockVideo[] }) => {
  const [playingId, setPlayingId] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      {videos.map((video) => (
        <div
          key={video.id}
          className="relative group/vid rounded-xl border border-border overflow-hidden bg-card"
        >
          {playingId === video.id ? (
            <video
              src={video.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full aspect-video object-cover"
              onClick={() => setPlayingId(null)}
            />
          ) : (
            <div className="relative cursor-pointer" onClick={() => setPlayingId(video.id)}>
              <img
                src={video.image}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-background/90 flex items-center justify-center">
                  <Play className="w-4 h-4 text-foreground ml-0.5" />
                </div>
              </div>
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          <div className="px-2.5 py-2 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground truncate flex-1">
              by {video.user.name}
            </p>
            <div className="flex items-center gap-1">
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Download HD"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="View on Pexels"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatMessage;
