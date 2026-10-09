import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, MessageSquare, Brain, Code, Paintbrush, Clapperboard, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskMode = "general" | "reasoning" | "developer" | "designer" | "video" | "agent";

type TaskModeOption = {
  id: TaskMode;
  label: string;
  icon: React.ElementType;
  description: string;
};

const TASK_MODES: TaskModeOption[] = [
  { id: "general", label: "General", icon: MessageSquare, description: "Everyday conversations & Q&A" },
  { id: "reasoning", label: "Reasoning", icon: Brain, description: "Deep analysis & problem solving" },
  { id: "developer", label: "Developer", icon: Code, description: "Write, review & debug code" },
  { id: "designer", label: "Designer", icon: Paintbrush, description: "Graphics, UI design & image generation" },
  { id: "video", label: "Video", icon: Clapperboard, description: "Create short-form & long-form videos" },
  { id: "agent", label: "Agent", icon: Bot, description: "Build apps & games (2D/3D)" },
];

type Props = {
  selectedMode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
};

const TaskModeSelector = ({ selectedMode, onModeChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 208; // w-52 = 13rem = 208px
      let left = rect.left + rect.width / 2 - popupWidth / 2;
      // Clamp to viewport
      if (left < 8) left = 8;
      if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - 8 - popupWidth;
      setPopupPos({ top: rect.top - 8, left });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentMode = TASK_MODES.find((m) => m.id === selectedMode) || TASK_MODES[0];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-8 rounded-full flex items-center justify-center border transition-colors gap-1.5",
          selectedMode === "general" ? "w-8" : "px-2.5",
          isOpen
            ? "bg-foreground text-background border-foreground"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        title={`Mode: ${currentMode.label}`}
      >
        {selectedMode === "general" ? (
          <Plus className={cn("w-[18px] h-[18px] transition-transform", isOpen && "rotate-45")} />
        ) : (
          <>
            <currentMode.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium leading-none">{currentMode.label}</span>
          </>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            style={{ position: "fixed", top: popupPos.top, left: popupPos.left, transform: "translateY(-100%)" }}
            className="w-52 bg-card border border-border rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="p-1.5">
              {TASK_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = mode.id === selectedMode;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      onModeChange(mode.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                      isSelected
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{mode.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{mode.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default TaskModeSelector;
