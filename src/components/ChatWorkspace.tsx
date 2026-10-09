import { useState, useRef, useEffect, useCallback } from "react";
import { AlignLeft, SquarePen, Sparkle, MessageCircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { useNavigate } from "@/lib/router-compat";
import AnnouncementBanner from "./AnnouncementBanner";

import type { AITool, ChatMessage as ChatMessageType } from "@/lib/types";
import ProfileMenu from "./ProfileMenu";
import { useChatHistory } from "@/context/ChatHistoryContext";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator, { detectPhase, type ThinkingPhase } from "./TypingIndicator";
import { detectAspectRatio } from "@/lib/detect-aspect-ratio";
import { getCategory } from "@/lib/file-converter";
import { analyzeZip } from "@/lib/zip-analyzer";
import type { TaskMode } from "./TaskModeSelector";
import { useBackgroundTasks, type BackgroundTask } from "@/hooks/useBackgroundTasks";
import { supabase } from "@/backend/client";
import { useAuth } from "@/context/AuthContext";

type Props = {
  tool?: AITool;
  onMenuClick: () => void;
  onNewChat?: () => void;
  initialMessages?: ChatMessageType[];
  chatId?: string;
  onChatCreated?: (id: string) => void;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const CODE_GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-generator`;
const FILE_CREATOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/file-creator`;
const AGENT_PLANNER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-planner`;

const ChatWorkspace = ({
  tool,
  onMenuClick,
  onNewChat,
  initialMessages,
  chatId: externalChatId,
  onChatCreated,
}: Props) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages || []);
  const [isTyping, setIsTyping] = useState(false);
  const initialMsgCount = useRef((initialMessages || []).length);
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>("thinking");
  const [chatId, setChatId] = useState<string | null>(externalChatId || null);
  const [chatTitle, setChatTitle] = useState<string | null>(null);
  const { addChat, updateChatMessages } = useChatHistory();
  const { tasks: bgTasks, activeTasks, dispatch: dispatchBgTask } = useBackgroundTasks(chatId);
  const { user } = useAuth();
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  // Track message IDs we've already seen to detect new ones
  const knownIdsRef = useRef<Set<string>>(new Set((initialMessages || []).map((m) => m.id)));

  // Whenever messages change, mark any new assistant messages for typewriter animation
  useEffect(() => {
    const newAssistantIds: string[] = [];
    for (const msg of messages) {
      if (!knownIdsRef.current.has(msg.id)) {
        knownIdsRef.current.add(msg.id);
        if (msg.role === "assistant") {
          newAssistantIds.push(msg.id);
        }
      }
    }
    if (newAssistantIds.length > 0) {
      setNewMessageIds((prev) => {
        const next = new Set(prev);
        newAssistantIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [messages]);

  // Handle background task completion — inject result as assistant message
  const handleBgTaskResult = useCallback((task: BackgroundTask) => {
    if (!task.result) return;
    const r = task.result;
    const msgBase = { id: `bg-${task.id}`, role: "assistant" as const, timestamp: new Date() };

    if (r.type === "chat") {
      setMessages((prev) => [...prev, { ...msgBase, content: r.content }]);
    } else if (r.type === "image") {
      setMessages((prev) => [
        ...prev,
        { ...msgBase, content: "Here is your generated image!", imageUrl: r.imageUrl },
      ]);
    } else if (r.type === "code") {
      setMessages((prev) => [
        ...prev,
        {
          ...msgBase,
          content: r.explanation || "Here's your generated web application!",
          webApp: {
            files: r.files,
            framework: r.framework,
            dependencies: r.dependencies || {},
            entryPoint: r.entryPoint || "index.html",
            explanation: r.explanation || "",
            quality: "production",
          },
        },
      ]);
    } else if (r.type === "file") {
      setMessages((prev) => [
        ...prev,
        {
          ...msgBase,
          content: r.explanation || `Here's your generated file:`,
          generatedFile: {
            fileName: r.fileName,
            content: r.content,
            mimeType: r.mimeType,
            format: r.format,
          },
        },
      ]);
    } else if (r.type === "agent") {
      setMessages((prev) => [
        ...prev,
        {
          ...msgBase,
          content: `🚀 **${r.plan?.title}** — ${r.stepResults?.length || 0} steps completed`,
          agentPlan: r.plan,
        },
      ]);
    }
  }, []);

  // On mount: recover any completed background tasks that have no corresponding message
  useEffect(() => {
    for (const task of bgTasks) {
      if (task.status === "done" && task.result) {
        const hasBgMsg = messages.some((m) => m.id === `bg-${task.id}`);
        if (!hasBgMsg) handleBgTaskResult(task);
      }
    }
  }, [bgTasks]);

  // Set title from initial messages when loading an existing chat
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && !chatTitle) {
      const firstUser = initialMessages.find((m) => m.role === "user");
      if (firstUser) {
        const raw =
          firstUser.content.length > 100 ? firstUser.content.slice(0, 100) : firstUser.content;
        setChatTitle(raw.length > 40 ? raw.slice(0, 40) + "..." : raw);
      }
    }
  }, [initialMessages]);

  // Persist messages to history whenever they change
  useEffect(() => {
    if (chatId && messages.length > 0) {
      updateChatMessages(chatId, messages);
      if (!externalChatId && !isTyping) onChatCreated?.(chatId);
    }
  }, [messages, chatId, updateChatMessages, externalChatId, isTyping, onChatCreated]);

  // Subscribe to new messages from Supabase Realtime
  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only add AI messages (user messages are added immediately in handleSend)
          if (newMsg.role === "assistant") {
            const chatMsg: ChatMessageType = {
              id: newMsg.id,
              role: "assistant",
              content: newMsg.content || "",
              timestamp: new Date(newMsg.created_at),
              imageUrl: newMsg.image_url || undefined,
              toolId: newMsg.metadata?.toolId,
            };
            setMessages((prev) => {
              // Avoid duplicates
              if (
                prev.some(
                  (m) =>
                    m.id === chatMsg.id ||
                    (m.role === chatMsg.role && m.content === chatMsg.content),
                )
              )
                return prev;
              return [...prev, chatMsg];
            });
            setNewMessageIds((prev) => new Set(prev).add(newMsg.id));
            setIsTyping(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  const handleSend = useCallback(
    async (
      content: string,
      imageData?: { base64: string; mimeType: string },
      taskMode?: TaskMode,
    ) => {
      const userMsg: ChatMessageType = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
        toolId: tool?.id,
        imageUrl: imageData ? `data:${imageData.mimeType};base64,${imageData.base64}` : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Detect phase from content
      const phase = detectPhase(content, tool?.id);
      setThinkingPhase("thinking"); // Always start with thinking
      setIsTyping(true);

      // Save first message as chat history entry
      if (!chatId) {
        const rawTitle = content.length > 100 ? content.slice(0, 100) : content;
        const title = rawTitle.length > 40 ? rawTitle.slice(0, 40) + "..." : rawTitle;
        const newId = addChat(title, content, tool?.id);
        setChatId(newId);
        setChatTitle(title);
      }

      // Transition from "thinking" to the detected work phase after a delay
      const phaseTimer = window.setTimeout(() => {
        setThinkingPhase(phase);
      }, 1200);
      let fetchPhaseTimer: number | undefined;
      let researchPhaseTimer: number | undefined;

      const clearPhaseTimers = () => {
        clearTimeout(phaseTimer);
        if (fetchPhaseTimer) clearTimeout(fetchPhaseTimer);
        if (researchPhaseTimer) clearTimeout(researchPhaseTimer);
      };

      // Story Creation mode detection — runs before image/video/agent so "create a story" routes here
      const isStoryRequest =
        /\b(create|generate|make|write|build|i\s*want\s*to\s*make)\b.{0,20}\b(story|tale|narrative)\b/i.test(
          content,
        ) ||
        /\b(horror|emotional|motivational|thriller|romance|mystery|fantasy|sci.?fi|comedy|drama)\s+story\b/i.test(
          content,
        );
      if (isStoryRequest) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Let's create your story. Fill in the details below — I'll handle the script, characters, scenes, prompts, and image generation.",
            timestamp: new Date(),
            story: { initialPrompt: content },
          },
        ]);
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // Designer mode: detect if it's a UI/web design request vs image generation
      const isUIDesign =
        taskMode === "designer" &&
        /\b(ui|ux|website|web\s*app|mobile\s*app|landing\s*page|dashboard|layout|wireframe|mockup|prototype|interface|screen|page\s*design|app\s*design|redesign)\b/i.test(
          content,
        );
      const isImageGen =
        (taskMode === "designer" && !isUIDesign) ||
        tool?.id === "image-generator" ||
        /\b(generate|create|make|draw|design)\b.*\b(image|picture|photo|illustration|graphic|visual|thumbnail|art|logo|icon|banner|poster|flyer|infographic|meme)\b/i.test(
          content,
        );
      const detectedRatio = detectAspectRatio(content);
      const isImageToImage = imageData && isImageGen;

      // UI/Web design → route to code generator with design-focused prompt
      if (isUIDesign) {
        try {
          const designPrompt = `You are a world-class UI/UX designer. Design and build: ${content}. Focus on: stunning visual design, modern UI patterns, smooth animations, responsive layout, proper spacing, beautiful typography, and cohesive color palette. Make it production-quality and pixel-perfect.`;
          dispatchBgTask(
            "code",
            { prompt: designPrompt, quality: "production" },
            chatId || undefined,
          ).catch(() => {});
          const resp = await fetch(CODE_GEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: designPrompt }],
              quality: "production",
            }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Design generation failed");

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.explanation || "Here's your UI design!",
              timestamp: new Date(),
              webApp: {
                files: data.files,
                framework: data.framework,
                dependencies: data.dependencies || {},
                entryPoint: data.entryPoint || "index.html",
                explanation: data.explanation || "",
                quality: "production",
              },
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, design generation failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      if (isImageToImage) {
        try {
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-to-image`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                image: imageData.base64,
                mimeType: imageData.mimeType,
                instruction: content,
                aspect_ratio: detectedRatio,
              }),
            },
          );
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Image generation failed");

          const firstImg = data.images?.[0];
          const imageUrl = firstImg?.base64
            ? `data:image/png;base64,${firstImg.base64}`
            : firstImg?.url || (typeof firstImg === "string" ? firstImg : undefined);

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Here is your generated image based on the reference. Prompt used: ${data.prompt || "optimized prompt"}`,
              timestamp: new Date(),
              toolId: tool?.id,
              imageUrl,
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, image generation failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      if (isImageGen && !imageData) {
        try {
          dispatchBgTask(
            "image",
            { prompt: content, aspect_ratio: detectedRatio },
            chatId || undefined,
          ).catch(() => {});
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ prompt: content, aspect_ratio: detectedRatio, model: "flux" }),
            },
          );
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Image generation failed");

          const firstImg = data.images?.[0];
          const imageUrl = firstImg?.base64
            ? `data:image/png;base64,${firstImg.base64}`
            : firstImg?.url || (typeof firstImg === "string" ? firstImg : undefined);

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: "Here is your generated image!",
              timestamp: new Date(),
              toolId: tool?.id,
              imageUrl,
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, image generation failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // Agent mode: web apps & games (2D/3D) builder detection
      const isAgent =
        taskMode === "agent" ||
        /\b(build|create|make|generate)\b.*\b(web\s*app|website|landing\s*page|dashboard|portfolio|SPA|single.page.app|game|2d|3d|platformer|rpg|puzzle|arcade|shooter|racing|runner|fighting|tower.defense|card.game|tetris|snake|pong|breakout|flappy|chess|checkers|fps|open.world|sandbox|survival|roguelike|roguelite|metroidvania|beat.em.up|rhythm|simulation|strategy|mmorpg|moba|battle.royale)\b/i.test(
          content,
        );

      if (isAgent) {
        try {
          // Gather existing project state from previous messages
          const lastWebApp = [...messages].reverse().find((m) => m.webApp)?.webApp;

          // Build conversation history for context continuity
          const conversationHistory = messages
            .filter((m) => !m.imageUrl && !m.videos && !m.videoGeneration && !m.videoEdit)
            .map((m) => ({ role: m.role, content: m.content }));

          // Detect quality mode from content
          const quality = /\b(production|prod|professional|polished)\b/i.test(content)
            ? "production"
            : /\b(prototype|proto|quick|simple|fast|basic)\b/i.test(content)
              ? "prototype"
              : "production"; // default to production for 10x quality

          dispatchBgTask(
            "code",
            { prompt: content, quality, projectState: lastWebApp, conversationHistory },
            chatId || undefined,
          ).catch(() => {});
          const resp = await fetch(CODE_GEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content }],
              projectState: lastWebApp || undefined,
              conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
              quality,
            }),
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Code generation failed");

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.explanation || "Here's your generated web application!",
              timestamp: new Date(),
              webApp: {
                files: data.files,
                framework: data.framework,
                dependencies: data.dependencies || {},
                entryPoint: data.entryPoint || "index.html",
                explanation: data.explanation || "",
                quality,
              },
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, code generation failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // File creation detection — user wants AI to create/write a file
      const fileFormatMatch =
        content.match(
          /\b(?:as|in|to|into)\s+(?:a\s+)?\.?(txt|pdf|md|html|css|csv|json|xml|js|ts|py|sql|yaml|toml|sh|bat|rtf|log|ini|cfg|env|xlsx|xls)\b/i,
        ) ||
        content.match(
          /\.?(txt|pdf|md|html|css|csv|json|xml|js|ts|py|sql|yaml|toml|sh|bat|rtf|xlsx|xls)\s+(?:file|format|document)/i,
        ) ||
        content.match(/\b(excel|spreadsheet|sheet|workbook)\b/i);
      const isFileCreate =
        /\b(write|create|generate|make|draft|compose|prepare)\b.*\b(file|document|script|letter|resume|report|essay|article|blog|story|poem|contract|invoice|receipt|plan|outline|notes|summary|readme|changelog|license|config|template|list|schedule|agenda|minutes|proposal|brief|spec|documentation|manual|guide|tutorial|faq|terms|policy|privacy|spreadsheet|sheet|excel|workbook|budget|ledger|tracker|timesheet|roster|inventory|catalog|database|table)\b/i.test(
          content,
        ) ||
        /\b(save|export|download)\b.*\b(as|to|into)\b.*\b(txt|pdf|md|html|csv|json|xml|xlsx|xls|excel|file)\b/i.test(
          content,
        ) ||
        /\b(write|create)\b.*\b(txt|pdf|md|html|csv|json|xml|xlsx|xls)\b/i.test(content) ||
        /\b(create|make|generate|build)\b.*\b(excel|spreadsheet|sheet|workbook)\b/i.test(content);

      if (isFileCreate && !isAgent) {
        const fmMatch = fileFormatMatch?.[1]?.toLowerCase();
        const isExcelKeyword = /\b(excel|spreadsheet|sheet|workbook)\b/i.test(content);
        const detectedFormat =
          isExcelKeyword &&
          (!fmMatch || ["excel", "spreadsheet", "sheet", "workbook"].includes(fmMatch))
            ? "xlsx"
            : fmMatch || "txt";

        try {
          dispatchBgTask(
            "file",
            { prompt: content, format: detectedFormat },
            chatId || undefined,
          ).catch(() => {});
          const resp = await fetch(FILE_CREATOR_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ prompt: content, format: detectedFormat }),
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "File creation failed");

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.explanation || `Here's your generated **${data.fileName}** file:`,
              timestamp: new Date(),
              generatedFile: {
                fileName: data.fileName,
                content: data.content,
                mimeType: data.mimeType,
                format: data.format,
              },
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, file creation failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // TTS / Voiceover detection
      const isTTS =
        /\b(voice\s*over|voiceover|tts|text[\s-]*to[\s-]*speech|narrat|read\s*aloud|speak\s*this|audio\s*of|convert\s*to\s*(speech|audio|voice)|generate\s*(voice|audio|speech|narration))\b/i.test(
          content,
        );
      if (isTTS) {
        // Extract the script — everything after intent words, or use full content
        let ttsScript = content
          .replace(/\b(create|make|generate|do|please|can you|could you)\b/gi, "")
          .replace(
            /\b(voice\s*over|voiceover|tts|text[\s-]*to[\s-]*speech|narration|audio|speech|voice)\b/gi,
            "",
          )
          .replace(/\b(of|for|from|the|this|following|script|text|in|mp3|wav|ogg|format)\b/gi, "")
          .replace(/[:"""]/g, "")
          .trim();

        // If cleaned script is too short, use full content as script
        if (ttsScript.length < 10) ttsScript = content;

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Here's your voiceover generator. Select a voice, format, and click generate:`,
            timestamp: new Date(),
            ttsScript: ttsScript,
          },
        ]);

        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // AI Video editing / generation detection
      const isVideoEdit =
        /\b(edit|cut|trim|crop|add\s*(text|music|filter|transition|overlay|effect)|change\s*(speed|timing|pacing)|slow\s*mo|speed\s*up|reorder|split|delete\s*scene|regenerate|re-?render|improve\s*video|enhance\s*video|make\s*(it|the\s*video)\s*(better|shorter|longer|faster|slower)|analyz|check\s*quality|visual\s*consistency|quality\s*check)\b/i.test(
          content,
        );
      const isVideoCreation =
        /\b(create|make|generate|produce)\b.*\b(video|short|reel|tiktok|clip|documentary|youtube|essay|explainer)\b.*\b(about|on|for|of)\b/i.test(
          content,
        ) ||
        /\b(short[\s-]*form|short|long[\s-]*form|long)\b.*\b(video|content)\b/i.test(content) ||
        /\b(create|make|generate)\b.*\b(video)\b/i.test(content);

      if (isVideoCreation || isVideoEdit) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: isVideoCreation
              ? `Processing your video request...`
              : `Applying your edits...`,
            timestamp: new Date(),
            videoEdit: {
              userMessage: content,
              isNewProject: isVideoCreation,
            },
          },
        ]);

        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // Stock footage search for video mode
      const isVideoSearch =
        taskMode === "video" ||
        /\b(stock\s*(footage|video|clip)|b[\s-]*roll|video\s*clip)\b/i.test(content);
      if (isVideoSearch) {
        try {
          // Extract search query - use Gemini to parse intent or fall back to content
          const searchQuery =
            content
              .replace(/\b(find|search|get|show|stock|footage|video|clip|b[\s-]*roll)\b/gi, "")
              .trim() || content;

          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pexels-videos`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ query: searchQuery, per_page: 6 }),
            },
          );
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Stock footage search failed");

          const videos = data.videos || [];
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content:
                videos.length > 0
                  ? `Found ${data.total_results} stock videos for "${searchQuery}". Here are the top results:`
                  : `No stock footage found for "${searchQuery}". Try a different search term.`,
              timestamp: new Date(),
              videos: videos.length > 0 ? videos : undefined,
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `Sorry, stock footage search failed: ${e.message}`,
              timestamp: new Date(),
            },
          ]);
        }
        clearTimeout(phaseTimer);
        setIsTyping(false);
        return;
      }

      // Multi-step agent detection — complex requests with multiple tasks
      const isMultiStep =
        /\b(and then|then|also|plus|after that|next|finally|step\s*\d|1\.|2\.|3\.)\b/i.test(
          content,
        ) &&
        content.length > 80 &&
        (content.match(/\b(generate|create|make|write|build|design)\b/gi) || []).length >= 2;

      if (isMultiStep) {
        try {
          dispatchBgTask("agent", { prompt: content }, chatId || undefined).catch(() => {});
          const resp = await fetch(AGENT_PLANNER_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ prompt: content }),
          });
          const plan = await resp.json();
          if (!resp.ok) throw new Error(plan.error || "Planning failed");

          if (plan.steps?.length > 1) {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `🚀 **${plan.title}** — Executing ${plan.steps.length} steps...`,
                timestamp: new Date(),
                agentPlan: plan,
              },
            ]);
            clearTimeout(phaseTimer);
            setIsTyping(false);
            return;
          }
          // If planner returned only 1 step, fall through to regular handling
        } catch (e: any) {
          console.warn("Agent planner failed, falling through to regular chat:", e.message);
          // Fall through to regular chat
        }
      }

      // Website analysis detection — user pasted a URL to analyze
      const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
      const hasUrl = urlPattern.test(content);
      const isWebAnalysis =
        hasUrl &&
        (/\b(analy[sz]e|check|review|inspect|scan|audit|examine|tell\s*me\s*about|what\s*is|details?\s*(about|of|on)|info(rmation)?\s*(about|of|on)|describe|explain|overview|look\s*at|visit|open|show\s*me|about\s*this|what.*website|website.*what)\b/i.test(
          content,
        ) ||
          content.replace(urlPattern, "").trim().length < 30);

      if (isWebAnalysis) {
        clearTimeout(phaseTimer);
        fetchPhaseTimer = window.setTimeout(() => setThinkingPhase("fetching"), 1200);
        researchPhaseTimer = window.setTimeout(() => setThinkingPhase("researching"), 3500);
      }

      // Regular chat - send to backend, response will come via Realtime
      try {
        const chatMessages = messages
          .filter((m) => !m.imageUrl || m.role === "user")
          .map((m) => {
            if (m.imageUrl && m.role === "user") {
              return {
                role: "user",
                content: [
                  { type: "text", text: m.content },
                  { type: "image_url", image_url: { url: m.imageUrl } },
                ],
              };
            }
            return { role: m.role, content: m.content };
          });

        if (imageData) {
          chatMessages.push({
            role: "user",
            content: [
              { type: "text", text: content },
              {
                type: "image_url",
                image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` },
              },
            ],
          });
        } else {
          chatMessages.push({ role: "user", content });
        }

        // Dispatch background task as insurance (runs server-side if user leaves)
        dispatchBgTask(
          "chat",
          { messages: chatMessages, toolId: tool?.id, webAnalysis: isWebAnalysis },
          chatId || undefined,
        ).catch(() => {});

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: chatMessages,
            toolId: tool?.id,
            webAnalysis: isWebAnalysis,
            sessionId: chatId,
            userId: user?.id,
          }),
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Chat failed");
        }

        // Response will arrive via Realtime subscription
        // Keep typing indicator until message arrives
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Sorry, an error occurred: ${e.message}`,
            timestamp: new Date(),
          },
        ]);
        clearTimeout(phaseTimer);
        setIsTyping(false);
      }
    },
    [tool, chatId, addChat, messages, updateChatMessages, dispatchBgTask],
  );

  const handleZipUpload = useCallback(
    async (file: File) => {
      const userMsg: ChatMessageType = {
        id: Date.now().toString(),
        role: "user",
        content: `Uploaded ZIP file: ${file.name}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setThinkingPhase("thinking");

      if (!chatId) {
        const title = `ZIP: ${file.name}`;
        const newId = addChat(title, `Uploaded ${file.name}`, tool?.id);
        setChatId(newId);
        setChatTitle(title);
      }

      try {
        const analysis = await analyzeZip(file);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Analyzed **${analysis.fileName}** — ${analysis.totalFiles} files in ${analysis.totalDirectories} folders (${formatBytes(analysis.totalSize)} total, ${analysis.compressionRatio}% compression). Top file types: ${Object.entries(
              analysis.fileTypes,
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([ext, n]) => `.${ext} (${n})`)
              .join(", ")}.`,
            timestamp: new Date(),
            zipAnalysis: analysis,
          },
        ]);
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Failed to extract ZIP file: ${e.message}`,
            timestamp: new Date(),
          },
        ]);
      }
      setIsTyping(false);
    },
    [chatId, addChat, tool],
  );

  const handleFileConvert = useCallback(
    (file: File) => {
      const cat = getCategory(file);
      if (!cat) return;

      const userMsg: ChatMessageType = {
        id: Date.now().toString(),
        role: "user",
        content: `Convert file: ${file.name}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (!chatId) {
        const title = `Convert: ${file.name}`;
        const newId = addChat(title, `Convert ${file.name}`, tool?.id);
        setChatId(newId);
        setChatTitle(title);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Here's the file converter for **${file.name}**. Select your target format and click convert:`,
          timestamp: new Date(),
          convertFile: file,
        },
      ]);
    },
    [chatId, addChat, tool],
  );

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  const hasMessages = messages.length > 0;
  const defaultTitle = tool ? tool.shortName : "Vision";

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      <header
        aria-label={chatTitle || defaultTitle}
        className="relative flex h-[49px] shrink-0 items-center gap-2 px-3 sm:px-6 bg-background"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="size-ui-control shrink-0 rounded-full border border-border bg-floating [&_svg]:size-ui-icon"
        >
          <AlignLeft />
        </Button>
        {!hasMessages && (
          <Button
            variant="secondary"
            onClick={() => navigate("/app/upgrade")}
            className="h-ui-control shrink-0 gap-1.5 rounded-full border border-border bg-upgrade px-3 text-sm font-semibold text-upgrade-foreground hover:bg-upgrade/90 [&_svg]:size-4"
          >
            <Sparkle />
            Get Plus
          </Button>
        )}
        <div
          className={
            hasMessages
              ? "ml-auto flex h-ui-control shrink-0 items-center rounded-full border border-border bg-floating"
              : "ml-auto"
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            onClick={onNewChat}
            className={
              hasMessages
                ? "size-ui-control shrink-0 rounded-full [&_svg]:size-ui-icon"
                : "size-ui-control shrink-0 rounded-full border border-border bg-floating [&_svg]:size-ui-icon"
            }
          >
            {hasMessages ? <SquarePen /> : <MessageCircleDashed />}
          </Button>
          {hasMessages && <ProfileMenu conversation />}
        </div>
      </header>
      <AnnouncementBanner />
      <Conversation className="min-h-0">
        <ConversationContent
          className={hasMessages ? "gap-0 px-0 pt-3 pb-6" : "h-full min-h-full p-0"}
        >
          {hasMessages ? (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} isNew={newMessageIds.has(msg.id)} />
              ))}
              {isTyping && <TypingIndicator phase={thinkingPhase} />}
            </>
          ) : (
            <EmptyState
              tool={tool}
              onPromptClick={(prompt) => {
                sessionStorage.setItem("prefill_prompt", prompt);
                window.dispatchEvent(new Event("prefill-prompt"));
              }}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton
          aria-label="Scroll to latest message"
          className="bottom-4 size-ui-control"
        />
      </Conversation>

      <ChatInput
        toolName={tool?.shortName}
        onSend={handleSend}
        onZipUpload={handleZipUpload}
        onFileConvert={handleFileConvert}
        disabled={isTyping}
      />
    </div>
  );
};

export default ChatWorkspace;
