import { useState } from "react";
import {
  Search,
  Image,
  Library,
  Folder,
  Plug,
  Radar,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  AudioLines,
  SquarePen,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { useNavigate } from "@/lib/router-compat";
import ProfileMenu from "./ProfileMenu";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  isMainChat: boolean;
  activeChatId?: string;
  chatHistory: {
    id: string;
    title: string;
    toolId?: string;
    preview: string;
    date: string;
    createdAt: number;
  }[];
};

export default function AppDrawer({
  open,
  onClose,
  onNewChat,
  onSelectChat,
  activeChatId,
  chatHistory,
}: Props) {
  const navigate = useNavigate();
  const { renameChat, deleteChat, searchHistory } = useChatHistory();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const history = query ? searchHistory(query) : chatHistory;
  const startChat = (prompt?: string) => {
    if (prompt) sessionStorage.setItem("prefill_prompt", prompt);
    onNewChat();
    onClose();
    if (prompt === "voice") {
      sessionStorage.removeItem("prefill_prompt");
      setTimeout(
        () => document.querySelector<HTMLButtonElement>('button[title="Voice input"]')?.click(),
        200,
      );
    }
  };
  const saveTitle = () => {
    if (editingId && title.trim()) renameChat(editingId, title.trim());
    setEditingId(null);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <SheetContent
        side="left"
        overlayClassName="bg-drawer-scrim"
        className="flex h-[100dvh] w-[80vw] max-w-[380px] flex-col gap-0 border-border bg-background p-0 shadow-none sm:max-w-[380px] [&>button]:-right-[58px] [&>button]:top-1 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-floating [&>button]:opacity-100 [&>button_svg]:size-5"
      >
        <div className="flex h-[57px] shrink-0 items-center justify-between gap-2 pl-8 pr-6">
        <SheetTitle className="font-sans text-[23px] font-semibold">
          Super Copilot
        </SheetTitle>
        <Button variant="secondary" size="icon" aria-label="Search conversations" onClick={() => setSearchOpen((value) => !value)} className="size-11 shrink-0 rounded-full border border-border bg-floating [&_svg]:size-6"><Search /></Button>
        </div>
        <SheetDescription className="sr-only">
          Chat navigation and saved conversations
        </SheetDescription>
        {searchOpen && <div className="mx-6 mt-2 flex h-11 shrink-0 items-center gap-3 rounded-full bg-muted px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Search chats"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28 pt-6">
          <nav aria-label="Workspace" className="space-y-0">
            {[
              { icon: Image, label: "Images", action: () => startChat("Generate an image of ") },
              {
                icon: Library,
                label: "Library",
                action: () =>
                  document.getElementById("drawer-recents")?.scrollIntoView({ behavior: "smooth" }),
              },
              {
                icon: Folder,
                label: "Projects",
                action: () => {
                  startChat();
                  setTimeout(() => window.dispatchEvent(new Event("open-projects")), 200);
                },
              },
              {
                icon: Plug,
                label: "Integrations",
                action: () => {
                  navigate("/app/integrations");
                  onClose();
                },
              },
              {
                icon: Radar,
                label: "Prospecting",
                action: () => {
                  navigate("/app/prospecting");
                  onClose();
                },
              },
            ].map(({ icon: Icon, label, action }) => (
              <Button
                key={label}
                variant="ghost"
                onClick={action}
                className="h-12 w-full justify-start gap-3 rounded-lg px-2 text-[18px] font-semibold [&_svg]:size-[22px] [&_svg]:stroke-[2]"
              >
                <Icon className="size-5" />
                {label}
              </Button>
            ))}
          </nav>
          <section id="drawer-recents" className="mt-9">
            <h3 className="mb-3 px-2 font-sans text-[17px] font-semibold text-foreground">
              {query ? "Results" : "Recents"}
            </h3>
            {history.length === 0 && (
              <p className="px-3 text-sm text-muted-foreground">
                {query ? "No matching chats" : ""}
              </p>
            )}
            {history.map((chat) => (
              <div key={chat.id} className="group flex min-w-0 items-center rounded-lg">
                {editingId === chat.id ? (
                  <div className="flex w-full items-center gap-1 px-3 py-2">
                    <input
                      aria-label="Chat title"
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded border border-input bg-muted px-2 py-1 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Save chat title"
                      onClick={saveTitle}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Cancel rename"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onSelectChat(chat.id);
                        onClose();
                      }}
                      className={cn(
                        "h-12 min-w-0 flex-1 justify-start px-2 text-[17px] font-normal",
                        activeChatId === chat.id && "bg-accent",
                      )}
                    >
                      <span className="truncate">{chat.title}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${chat.title}`} className="text-muted-foreground opacity-50 transition-opacity hover:opacity-100 group-focus-within:opacity-100"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingId(chat.id); setTitle(chat.title); }}><Pencil />Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteChat(chat.id)} className="text-destructive"><Trash2 />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </section>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-[88px] items-center justify-between gap-3 bg-background/95 pl-8 pr-6 pb-3">
          <Button
            onClick={() => startChat()}
            className="h-12 gap-3 rounded-full bg-navigation px-6 text-[18px] font-medium text-navigation-foreground hover:bg-navigation/90 [&_svg]:size-[22px]"
          >
            <SquarePen />
            Chat
          </Button>
          <div className="flex items-center gap-3">
            <ProfileMenu />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Start voice typing"
              onClick={() => startChat("voice")}
              className="absolute -right-[52px] bottom-[26px] size-8 rounded-full bg-navigation text-navigation-foreground hover:bg-navigation/90 [&_svg]:size-[18px]"
            >
              <AudioLines className="size-5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
