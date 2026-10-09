import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskModeSelector, { type TaskMode } from "./TaskModeSelector";

type Props = {
  toolName?: string;
  onSend: (message: string, imageData?: { base64: string; mimeType: string }, taskMode?: TaskMode) => void;
  onZipUpload?: (file: File) => void;
  onFileConvert?: (file: File) => void;
  disabled?: boolean;
};

const ChatInput = ({ toolName, onSend, onZipUpload, onFileConvert, disabled }: Props) => {
  const [value, setValue] = useState("");
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [taskMode, setTaskMode] = useState<TaskMode>("general");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const newValue = (finalTranscriptRef.current + interim).trimStart();
      setValue(newValue);
      autoResize();
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech recognition error:", e.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      finalTranscriptRef.current = value;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn("Speech recognition start failed:", e);
      }
    }
  };

  const hasText = value.trim().length > 0;
  const hasContent = hasText || attachedImage;

  const handleSend = () => {
    if (!hasContent || disabled) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    onSend(
      value.trim() || (attachedImage ? "Analyze this image" : ""),
      attachedImage ? { base64: attachedImage.base64, mimeType: attachedImage.mimeType } : undefined,
      taskMode
    );
    setValue("");
    finalTranscriptRef.current = "";
    setAttachedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // On touch devices (mobile), Enter should insert a newline (default behavior).
    // Only submit on Enter when on a device with a real keyboard (fine pointer / hover).
    if (e.key !== "Enter" || e.shiftKey) return;
    const isTouchDevice =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches ||
        window.matchMedia?.("(hover: none)").matches);
    if (isTouchDevice) return; // let newline through
    e.preventDefault();
    handleSend();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle ZIP files
    if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
      onZipUpload?.(file);
      e.target.value = "";
      return;
    }

    // Handle image files for chat attachment
    if (file.type.startsWith("image/") && !e.target.dataset.convertMode) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        setAttachedImage({ base64, mimeType: file.type, preview: result });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }

    // Handle any other file for conversion
    onFileConvert?.(file);
    e.target.value = "";
  };

  // Animated dots for prompt hint
  const [dotCount, setDotCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const animatedDots = ".".repeat(dotCount);

  return (
    <div className="w-full px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-[24px] transition-colors duration-200 focus-within:border-foreground/20 overflow-hidden">
          {/* Attached image preview */}
          {attachedImage && (
            <div className="px-3 pt-3">
              <div className="relative inline-block">
                <img
                  src={attachedImage.preview}
                  alt="Attached"
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Textarea — grows vertically, shape stays the same */}
          <div className="relative">
            {!value && (
              <span className="pointer-events-none absolute left-4 top-3 text-[15px] text-muted-foreground select-none">
                Ask Copilot{animatedDots}
              </span>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={1}
              className="w-full bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground resize-none outline-none min-h-[44px] max-h-[200px] py-3 px-4"
            />
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.zip,application/zip,video/*,audio/*,.txt,.pdf,.html,.md,.csv,.json,.xml,.mp4,.webm,.avi,.mov,.mkv,.mp3,.wav,.ogg,.aac,.flac,.m4a,.bmp,.gif,.ico,.svg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-[18px] h-[18px]" />
              </button>
              <TaskModeSelector selectedMode={taskMode} onModeChange={setTaskMode} />
            </div>

            {!hasContent && (
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border transition-all",
                  isListening
                    ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
              </button>
            )}
            {hasContent && (
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled}
                className="w-8 h-8 rounded-full flex items-center justify-center border bg-foreground text-background border-foreground hover:opacity-80 disabled:opacity-50 transition-all"
              >
                <ArrowUp className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-2 hidden sm:block">
          Super Copilot may produce inaccurate results. Verify important information.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
