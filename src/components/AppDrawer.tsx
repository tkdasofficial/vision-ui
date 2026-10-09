import { useState } from "react";
import { Search, Image, Library, Folder, Plug, Radar, MessageSquare, Pencil, Trash2, Check, X, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { useNavigate } from "@/lib/router-compat";
import ProfileMenu from "./ProfileMenu";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean; onClose: () => void; onNewChat: () => void; onSelectChat: (id: string) => void;
  isMainChat: boolean; activeChatId?: string;
  chatHistory: { id: string; title: string; toolId?: string; preview: string; date: string; createdAt: number }[];
};

export default function AppDrawer({ open, onClose, onNewChat, onSelectChat, activeChatId, chatHistory }: Props) {
  const navigate = useNavigate();
  const { renameChat, deleteChat, searchHistory } = useChatHistory();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const history = query ? searchHistory(query) : chatHistory;
  const startChat = (prompt?: string) => {
    if (prompt) sessionStorage.setItem("prefill_prompt", prompt);
    onNewChat(); onClose();
    if (prompt === "voice") { sessionStorage.removeItem("prefill_prompt"); setTimeout(() => document.querySelector<HTMLButtonElement>('button[title="Voice input"]')?.click(), 200); }
  };
  const saveTitle = () => { if (editingId && title.trim()) renameChat(editingId, title.trim()); setEditingId(null); };
  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <SheetContent side="left" className="flex h-[100dvh] w-full max-w-[380px] flex-col gap-0 border-border bg-background p-0 sm:max-w-[380px] [&>button]:right-5 [&>button]:top-5">
        <SheetTitle className="px-6 pt-5 text-base font-sans font-semibold">Super Copilot</SheetTitle>
        <SheetDescription className="sr-only">Chat navigation and saved conversations</SheetDescription>
        <div className="mx-5 mt-6 flex h-11 items-center gap-3 rounded-full bg-muted px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input aria-label="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5">
          <nav aria-label="Workspace" className="space-y-1">
            {[
              { icon: Image, label: "Images", action: () => startChat("Generate an image of ") },
              { icon: Library, label: "Library", action: () => document.getElementById("drawer-recents")?.scrollIntoView({ behavior: "smooth" }) },
              { icon: Folder, label: "Projects", action: () => startChat("Build a web application: ") },
              { icon: Plug, label: "Integrations", action: () => { navigate("/app/integrations"); onClose(); } },
              { icon: Radar, label: "Prospecting", action: () => { navigate("/app/prospecting"); onClose(); } },
            ].map(({ icon: Icon, label, action }) => <Button key={label} variant="ghost" onClick={action} className="h-12 w-full justify-start gap-4 rounded-lg px-3 text-base font-normal"><Icon className="size-5" />{label}</Button>)}
          </nav>
          <section id="drawer-recents" className="mt-7">
            <h3 className="mb-3 px-3 font-sans text-xs font-medium text-muted-foreground">{query ? "Results" : "Recents"}</h3>
            {history.length === 0 && <p className="px-3 text-sm text-muted-foreground">{query ? "No matching chats" : "No conversations yet"}</p>}
            {history.map((chat) => <div key={chat.id} className="group flex min-w-0 items-center rounded-lg">
              {editingId === chat.id ? <div className="flex w-full items-center gap-1 px-3 py-2">
                <input aria-label="Chat title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingId(null); }} className="min-w-0 flex-1 rounded border border-input bg-muted px-2 py-1 text-sm" />
                <Button variant="ghost" size="icon-sm" aria-label="Save chat title" onClick={saveTitle}><Check className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Cancel rename" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
              </div> : <>
                <Button variant="ghost" onClick={() => { onSelectChat(chat.id); onClose(); }} className={cn("h-12 min-w-0 flex-1 justify-start px-3 text-sm font-normal", activeChatId === chat.id && "bg-accent")}><span className="truncate">{chat.title}</span></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Rename ${chat.title}`} onClick={() => { setEditingId(chat.id); setTitle(chat.title); }} className="text-muted-foreground"><Pencil className="size-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${chat.title}`} onClick={() => deleteChat(chat.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
              </>}
            </div>)}
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 bg-background px-5 pb-6 pt-3">
          <Button onClick={() => startChat()} className="h-12 gap-3 rounded-full bg-navigation px-6 text-navigation-foreground hover:bg-navigation/90"><MessageSquare className="size-5" />Chat</Button>
          <div className="flex items-center gap-3"><ProfileMenu /><Button variant="secondary" size="icon" aria-label="Start voice typing" onClick={() => startChat("voice")} className="size-11 rounded-full bg-floating"><AudioLines className="size-5" /></Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
