import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { type AITool, type ChatMessage } from "@/lib/types";
import { useChatHistory } from "@/context/ChatHistoryContext";
import AppDrawer from "@/components/AppDrawer";
import ChatWorkspace from "@/components/ChatWorkspace";

const Index = () => {
  const { chatId: urlChatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { getChatById, history, loadChatMessages } = useChatHistory();

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[] | undefined>(undefined);

  // Sync URL param to state
  useEffect(() => {
    let cancelled = false;
    if (urlChatId) {
      loadChatMessages(urlChatId).then((msgs) => {
        if (cancelled) return;
        setActiveChatId(urlChatId);
        setLoadedMessages(msgs);
        setChatKey((k) => k + 1);
      });
    } else {
      setActiveChatId(undefined);
      setLoadedMessages(undefined);
      setChatKey((k) => k + 1);
    }
    return () => { cancelled = true; };
  }, [urlChatId, loadChatMessages]);

  const handleNewChat = () => {
    setSelectedTool(undefined);
    setActiveChatId(undefined);
    setLoadedMessages(undefined);
    setChatKey((k) => k + 1);
    navigate("/app/new");
  };

  const handleSelectChat = useCallback((id: string) => {
    navigate(`/app/chat/${id}`);
  }, [navigate]);

  const handleChatCreated = useCallback((id: string) => {
    setActiveChatId(id);
    navigate(`/app/chat/${id}`, { replace: true });
  }, [navigate]);

  const activeChat = activeChatId ? getChatById(activeChatId) : undefined;
  const initialMessages = loadedMessages || activeChat?.messages;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <AppDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        isMainChat={!selectedTool && !activeChatId}
        activeChatId={activeChatId}
        chatHistory={history}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {urlChatId && activeChatId !== urlChatId ? <div role="status" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading conversation…</div> : <ChatWorkspace
          key={chatKey}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
          onNewChat={handleNewChat}
          initialMessages={initialMessages && initialMessages.length > 0 ? initialMessages : undefined}
          chatId={activeChatId}
          onChatCreated={handleChatCreated}
        />}
      </main>
    </div>
  );
};

export default Index;
