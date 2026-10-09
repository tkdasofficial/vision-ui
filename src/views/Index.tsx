import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { type AITool } from "@/lib/types";
import { useChatHistory } from "@/context/ChatHistoryContext";
import DesktopSidebar from "@/components/DesktopSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ChatWorkspace from "@/components/ChatWorkspace";

const Index = () => {
  const { chatId: urlChatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { getChatById, history, loadChatMessages } = useChatHistory();

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(urlChatId);
  const [loadedMessages, setLoadedMessages] = useState<any[] | undefined>(undefined);

  // Sync URL param to state
  useEffect(() => {
    if (urlChatId && urlChatId !== activeChatId) {
      setActiveChatId(urlChatId);
      loadChatMessages(urlChatId).then((msgs) => {
        setLoadedMessages(msgs);
        setChatKey((k) => k + 1);
      });
    } else if (!urlChatId && activeChatId) {
      setActiveChatId(undefined);
      setLoadedMessages(undefined);
      setChatKey((k) => k + 1);
    }
  }, [urlChatId]);

  const handleNewChat = () => {
    setSelectedTool(undefined);
    setActiveChatId(undefined);
    setLoadedMessages(undefined);
    setChatKey((k) => k + 1);
    navigate("/app/new");
  };

  const handleSelectChat = useCallback(async (id: string) => {
    setActiveChatId(id);
    const msgs = await loadChatMessages(id);
    setLoadedMessages(msgs);
    setChatKey((k) => k + 1);
    navigate(`/app/chat/${id}`);
  }, [loadChatMessages, navigate]);

  const handleChatCreated = useCallback((id: string) => {
    setActiveChatId(id);
    navigate(`/app/chat/${id}`, { replace: true });
  }, [navigate]);

  const activeChat = activeChatId ? getChatById(activeChatId) : undefined;
  const initialMessages = loadedMessages || activeChat?.messages;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <DesktopSidebar
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        isMainChat={!selectedTool && !activeChatId}
        activeChatId={activeChatId}
        chatHistory={history}
      />
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        isMainChat={!selectedTool && !activeChatId}
        activeChatId={activeChatId}
        chatHistory={history}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWorkspace
          key={chatKey}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
          initialMessages={initialMessages && initialMessages.length > 0 ? initialMessages : undefined}
          chatId={activeChatId}
          onChatCreated={handleChatCreated}
        />
      </main>
    </div>
  );
};

export default Index;
