import { cn } from "@/lib/utils";
import { X, PenSquare, MessageSquare, Pencil, Trash2, Check, Image, Video, FileText, Music, Sparkles, Plug } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { useChatHistory } from "@/context/ChatHistoryContext";
import logo from "@/assets/logo.svg";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  isMainChat: boolean;
  activeChatId?: string;
  chatHistory: { id: string; title: string; toolId?: string }[];
};

const MobileSidebar = ({ open, onClose, onNewChat, onSelectChat, isMainChat, activeChatId, chatHistory }: Props) => {
  const navigate = useNavigate();
  const { renameChat, deleteChat } = useChatHistory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const confirmRename = () => {
    if (editingId && editValue.trim()) renameChat(editingId, editValue.trim());
    setEditingId(null);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Super Copilot" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-display font-semibold text-foreground text-sm">Super Copilot</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-2 space-y-1.5">
          <button
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Media quick-launch */}
        <div className="px-3 pt-2">
          <p className="px-3 pb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Media</p>
          <div className="flex items-center gap-1.5 px-1">
            {[
              { icon: Image, label: "Image", prompt: "Generate an image of " },
              { icon: Video, label: "Video", prompt: "Create a video about " },
              { icon: FileText, label: "File", prompt: "Create a file: " },
              { icon: Music, label: "Audio", prompt: "Generate audio for " },
              { icon: Sparkles, label: "Other", prompt: "" },
            ].map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => { onNewChat(); onClose(); if (prompt) sessionStorage.setItem("prefill_prompt", prompt); }}
                title={label}
                className="group flex-1 aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent hover:border-primary/40 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-sidebar-foreground group-hover:text-primary" />
                <span className="text-[9px] text-muted-foreground group-hover:text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="px-3 pt-3">
          <button
            onClick={() => { navigate("/app/integrations"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-transparent hover:border-primary/30 group"
          >
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plug className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="flex-1 text-left font-medium">Integrations</span>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">New</span>
          </button>
        </div>


        {chatHistory.length > 0 && (
          <div className="px-3 pt-4 flex-1 overflow-y-auto">
            <p className="px-3 pb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Recent</p>
            <nav className="space-y-0.5">
              {chatHistory.map((chat) => (
                <div key={chat.id} className="group relative">
                  {editingId === chat.id ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 px-2 py-1 rounded text-sm bg-sidebar-accent text-sidebar-foreground outline-none border border-primary/40"
                      />
                      <button onClick={confirmRename} className="p-1 rounded text-primary hover:bg-sidebar-accent">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded text-muted-foreground hover:bg-sidebar-accent">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={() => { onSelectChat(chat.id); onClose(); }}
                        className={cn(
                          "flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors truncate flex items-center gap-2",
                          activeChatId === chat.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {activeChatId === chat.id && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                          </span>
                        )}
                        <span className="truncate">{chat.title}</span>
                      </button>
                      <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                        <button onClick={() => startRename(chat.id, chat.title)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteChat(chat.id)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>
    </>
  );
};

export default MobileSidebar;
