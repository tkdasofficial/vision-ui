import { cn } from "@/lib/utils";
import { PenSquare, Search, MessageSquare, Pencil, Trash2, Check, X, Image, Video, FileText, Music, Sparkles, Plug, Radar } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { useChatHistory } from "@/context/ChatHistoryContext";
import logo from "@/assets/logo.svg";

type Props = {
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  isMainChat: boolean;
  activeChatId?: string;
  chatHistory: { id: string; title: string; toolId?: string; preview: string; date: string; createdAt: number }[];
};

const DesktopSidebar = ({ onNewChat, onSelectChat, isMainChat, activeChatId, chatHistory }: Props) => {
  const navigate = useNavigate();
  const { renameChat, deleteChat, searchHistory } = useChatHistory();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  

  const displayHistory = searchQuery ? searchHistory(searchQuery) : chatHistory;

  const startRename = (chat: { id: string; title: string }) => {
    setEditingId(chat.id);
    setEditValue(chat.title);
  };

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      renameChat(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-sidebar border-r border-sidebar-border h-full shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={logo} alt="Super Copilot" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-display font-semibold text-foreground text-sm">Super Copilot</span>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          <span>New chat</span>
        </button>
        <button
          onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>
        {searchOpen && (
          <div className="px-1 pb-1">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-sidebar-accent text-sidebar-foreground placeholder:text-muted-foreground outline-none border border-sidebar-border focus:border-primary/40 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Media quick-launch */}
      <div className="px-3 pt-3">
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
              onClick={() => { onNewChat(); if (prompt) sessionStorage.setItem("prefill_prompt", prompt); }}
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
          onClick={() => navigate("/app/integrations")}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-transparent hover:border-primary/30 group"
        >
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plug className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="flex-1 text-left font-medium">Integrations</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">New</span>
        </button>
        <button
          onClick={() => navigate("/app/prospecting")}
          className="mt-1 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-transparent hover:border-primary/30 group"
        >
          <div className="w-6 h-6 rounded-md bg-foreground/10 flex items-center justify-center group-hover:bg-foreground/20 transition-colors">
            <Radar className="w-3.5 h-3.5 text-foreground" />
          </div>
          <span className="flex-1 text-left font-medium">Prospecting</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground text-background font-semibold">Agent</span>
        </button>
      </div>

      {displayHistory.length > 0 && (
        <div className="px-3 pt-4 flex-1 overflow-y-auto">
          <p className="px-3 pb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            {searchQuery ? "Results" : "Recent"}
          </p>
          <nav className="space-y-0.5">
            {displayHistory.map((chat) => (
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
                      onClick={() => onSelectChat(chat.id)}
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
                      <button onClick={() => startRename(chat)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent">
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
    </aside>
  );
};

export default DesktopSidebar;
