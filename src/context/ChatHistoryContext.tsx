import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/types";
import { supabase } from "@/backend/client";
import { useAuth } from "./AuthContext";

export type ChatHistoryItem = {
  id: string;
  title: string;
  toolId?: string;
  preview: string;
  date: string;
  createdAt: number;
  messages: ChatMessage[];
};

type ChatHistoryContextType = {
  history: ChatHistoryItem[];
  loading: boolean;
  addChat: (title: string, preview: string, toolId?: string) => string;
  renameChat: (id: string, newTitle: string) => void;
  deleteChat: (id: string) => void;
  searchHistory: (query: string) => ChatHistoryItem[];
  updateChatMessages: (id: string, messages: ChatMessage[]) => void;
  getChatById: (id: string) => ChatHistoryItem | undefined;
  loadChatMessages: (id: string) => Promise<ChatMessage[]>;
};

// Keep one context instance across hot reloads so the provider and consumers always match.
const CTX_KEY = "__sc_chat_history_ctx__";
const ChatHistoryContext: React.Context<ChatHistoryContextType | null> =
  ((globalThis as any)[CTX_KEY] ??= createContext<ChatHistoryContextType | null>(null));

/* ── localStorage cache helpers ── */
const LS_SESSIONS_KEY = "sc_chat_sessions";
const LS_MESSAGES_PREFIX = "sc_chat_msgs_";
const LS_MAX_CACHED_CHATS = 50;

function lsGetSessions(): ChatHistoryItem[] {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSetSessions(items: ChatHistoryItem[]) {
  try {
    // Store without messages to keep size small
    const slim = items.slice(0, LS_MAX_CACHED_CHATS).map(({ messages, ...rest }) => ({ ...rest, messages: [] }));
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(slim));
  } catch { /* quota exceeded — silently ignore */ }
}

function lsGetMessages(sessionId: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(LS_MESSAGES_PREFIX + sessionId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSetMessages(sessionId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(LS_MESSAGES_PREFIX + sessionId, JSON.stringify(msgs));
  } catch { /* quota exceeded */ }
}

function lsRemoveMessages(sessionId: string) {
  try { localStorage.removeItem(LS_MESSAGES_PREFIX + sessionId); } catch {}
}

const getDateLabel = (ts: number): string => {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Serialize a ChatMessage's extra data into a JSONB-safe metadata object */
function buildMetadata(msg: ChatMessage): Record<string, any> {
  const meta: Record<string, any> = {};
  if (msg.toolId) meta.toolId = msg.toolId;
  if (msg.videos) meta.videos = msg.videos;
  if (msg.videoGeneration) meta.videoGeneration = msg.videoGeneration;
  if (msg.videoEdit) meta.videoEdit = msg.videoEdit;
  if (msg.webApp) meta.webApp = msg.webApp;
  return meta;
}

/** Reconstruct a ChatMessage from a DB row */
function rowToMessage(row: any): ChatMessage {
  const meta = (row.metadata || {}) as Record<string, any>;
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    timestamp: new Date(row.created_at),
    imageUrl: row.image_url || undefined,
    toolId: meta.toolId,
    videos: meta.videos,
    videoGeneration: meta.videoGeneration,
    videoEdit: meta.videoEdit,
    webApp: meta.webApp,
  };
}

export const ChatHistoryProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage cache for instant render
  const [history, setHistory] = useState<ChatHistoryItem[]>(() => lsGetSessions());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Sync history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) lsSetSessions(history);
  }, [history]);

  // Load sessions from Supabase on mount / user change
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load chat sessions:", error);
        setLoading(false);
        return;
      }

      const items: ChatHistoryItem[] = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        toolId: s.tool_id,
        preview: s.preview,
        date: getDateLabel(new Date(s.created_at).getTime()),
        createdAt: new Date(s.created_at).getTime(),
        messages: [],
      }));

      setHistory(items);
      setLoading(false);
    };

    loadSessions();
    return () => { cancelled = true; };
  }, [user]);

  // Load messages for a specific chat session
  const loadChatMessages = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    // Try localStorage cache first for instant load
    const cached = lsGetMessages(sessionId);
    if (cached && cached.length > 0) {
      setHistory((prev) =>
        prev.map((h) => (h.id === sessionId ? { ...h, messages: cached } : h))
      );
      // Still fetch from DB in background to get latest
      supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const msgs = data.map(rowToMessage);
            lsSetMessages(sessionId, msgs);
            setHistory((prev) =>
              prev.map((h) => (h.id === sessionId ? { ...h, messages: msgs } : h))
            );
          }
        });
      return cached;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load chat messages:", error);
      return [];
    }

    const msgs = (data || []).map(rowToMessage);
    lsSetMessages(sessionId, msgs);

    setHistory((prev) =>
      prev.map((h) => (h.id === sessionId ? { ...h, messages: msgs } : h))
    );

    return msgs;
  }, []);

  const addChat = useCallback((title: string, preview: string, toolId?: string) => {
    // Create a temporary ID for immediate UI update
    const tempId = crypto.randomUUID();
    const item: ChatHistoryItem = {
      id: tempId,
      title,
      preview,
      toolId,
      date: getDateLabel(Date.now()),
      createdAt: Date.now(),
      messages: [],
    };
    setHistory((prev) => [item, ...prev]);

    // Persist to Supabase in background
    if (user) {
      supabase
        .from("chat_sessions")
        .insert({
          id: tempId,
          user_id: user.id,
          title,
          preview,
          tool_id: toolId || null,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to save chat session:", error);
        });
    }

    return tempId;
  }, [user]);

  const renameChat = useCallback((id: string, newTitle: string) => {
    setHistory((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));

    supabase
      .from("chat_sessions")
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("Failed to rename chat:", error);
      });
  }, []);

  const deleteChat = useCallback((id: string) => {
    setHistory((prev) => prev.filter((c) => c.id !== id));
    lsRemoveMessages(id);

    supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("Failed to delete chat:", error);
      });
  }, []);

  const searchHistory = useCallback(
    (query: string) => {
      if (!query.trim()) return history;
      const q = query.toLowerCase();
      return history.filter(
        (c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
      );
    },
    [history]
  );

  const updateChatMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setHistory((prev) => prev.map((c) => (c.id === id ? { ...c, messages } : c)));
    lsSetMessages(id, messages);

    // Debounced save — only save the latest message that isn't saved yet
    // We track by checking if the message ID looks like a DB uuid or a timestamp
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    // Save messages that are new (timestamp-based IDs from the frontend)
    const newMessages = messages.filter((m) => /^\d+$/.test(m.id));
    if (newMessages.length === 0) return;

    const rows = newMessages.map((m) => ({
      id: m.id.length < 36 ? crypto.randomUUID() : m.id,
      session_id: id,
      role: m.role as string,
      content: m.content,
      image_url: m.imageUrl || null,
      metadata: buildMetadata(m) as any,
    }));

    supabase
      .from("chat_messages")
      .upsert(rows, { onConflict: "id" })
      .then(({ error }) => {
        if (error) console.error("Failed to save messages:", error);
      });

    // Update session's updated_at
    supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => {});
  }, []);

  const getChatById = useCallback((id: string) => {
    return history.find((c) => c.id === id);
  }, [history]);

  return (
    <ChatHistoryContext.Provider
      value={{
        history,
        loading,
        addChat,
        renameChat,
        deleteChat,
        searchHistory,
        updateChatMessages,
        getChatById,
        loadChatMessages,
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error("useChatHistory must be used within ChatHistoryProvider");
  return ctx;
};
