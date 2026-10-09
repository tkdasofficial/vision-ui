import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
  "script-writer": `You are an expert AI Script Writer for video creators. You specialize in writing engaging, retention-optimized scripts for YouTube videos, shorts, stories, and other platforms. Structure your scripts with clear sections: HOOK, INTRO, BODY (with numbered points or segments), CTA, and OUTRO. Include timing markers. Focus on viewer retention hooks, pattern interrupts, and engagement triggers.`,
  "thumbnail-designer": `You are an expert AI Thumbnail Designer. You create detailed thumbnail concepts optimized for maximum click-through rate (CTR). Provide: 1) Visual composition description, 2) Text overlay suggestions (keep it 3-5 words max), 3) Color palette recommendations, 4) Facial expression/emotion guidance, 5) Contrast and readability tips.`,
  "seo-optimizer": `You are an expert AI SEO Optimizer for video and content platforms. You generate optimized titles, descriptions, tags, and keywords. Provide: 1) SEO-optimized title options (under 60 chars), 2) Full video description with timestamps and keywords, 3) Relevant tags and keywords list, 4) Hashtag suggestions, 5) Search ranking tips.`,
  "image-generator": `You are an expert AI Image Creator assistant. When users request images, create highly detailed, optimized prompts for image generation. Describe: subject, composition, lighting, color palette, style, mood, camera angle, and technical details.`,
  "content-optimizer": `You are a comprehensive Content Optimizer AI. You provide full content packages including: script outlines, SEO optimization, thumbnail concepts, tag strategies, and growth recommendations.`,
  "content-analyzer": `You are an expert Content Analyzer AI. You analyze existing content and provide specific, actionable improvement suggestions. Focus on: retention analysis, CTR optimization, SEO strength, audience engagement, and competitive positioning.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are Super Copilot, a powerful AI assistant for content creators. You help with brainstorming, writing, strategy, analysis, and creative tasks. Be helpful, concise, and actionable. Format responses clearly with structured sections when appropriate.`;

const WEB_ANALYSIS_SYSTEM_PROMPT = `You are Super Copilot with web analysis capabilities. When a user provides a URL or asks about a website, use your Google Search grounding capabilities to find real, up-to-date information about that website.

Your analysis should include (when publicly available):
1. **Website Overview** — What the site is about, its purpose, and owner/company
2. **Key Features & Content** — Main offerings, services, or content available
3. **Technology Stack** — Any known technologies, frameworks, or platforms used
4. **Traffic & Popularity** — Known rankings, traffic estimates, or popularity metrics
5. **Reputation & Reviews** — Public sentiment, reviews, or notable mentions
6. **Social Presence** — Social media links, follower counts if known
7. **SEO & Domain Info** — Domain age, authority indicators if available

If the website requires authentication or login to view content, clearly state:
"⚠️ **Authentication Required** — This website requires login/authentication to access its content. The details shown are based on publicly available information only. To view protected content, you would need valid credentials or an authorized account."

If information is limited, explain what data is publicly available and what requires authentication. Always be honest about what you can and cannot access. Use grounded, factual data from Google Search — never fabricate details.`;

// Extract URLs from text
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  return matches;
}

// Detect if user is asking to analyze/check a website
function isWebAnalysisRequest(text: string): boolean {
  const urls = extractUrls(text);
  if (urls.length === 0) return false;

  const lower = text.toLowerCase();
  const hasAnalysisIntent = /\b(analy[sz]e|check|review|inspect|scan|audit|examine|tell\s*me\s*about|what\s*is|details?\s*(about|of|on)|info(rmation)?\s*(about|of|on)|describe|explain|overview|look\s*at|visit|open|show\s*me|go\s*to|about\s*this|what.*website|website.*what)\b/i.test(lower);
  if (hasAnalysisIntent) return true;

  const urlRemoved = text.replace(/https?:\/\/[^\s]+/g, "").trim();
  if (urlRemoved.length < 30) return true;

  return false;
}

/** Fetch a webpage and extract text content */
async function fetchWebpageContent(url: string): Promise<{ html: string; text: string; title: string; meta: Record<string, string>; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SuperCopilotBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { html: "", text: "", title: "", meta: {}, error: `AUTH_REQUIRED (${resp.status})` };
      }
      return { html: "", text: "", title: "", meta: {}, error: `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { html: "", text: "", title: "", meta: {}, error: `Non-HTML content: ${contentType}` };
    }

    const html = await resp.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    // Extract meta tags
    const meta: Record<string, string> = {};
    const metaRegex = /<meta\s+(?:[^>]*?(?:name|property)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*?)["']|[^>]*?content\s*=\s*["']([^"']*?)["'][^>]*?(?:name|property)\s*=\s*["']([^"']+)["'])[^>]*>/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      const name = (metaMatch[1] || metaMatch[4] || "").toLowerCase();
      const content = metaMatch[2] || metaMatch[3] || "";
      if (name && content) meta[name] = content;
    }

    // Extract visible text: remove scripts, styles, then tags
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " [FOOTER] ")
      .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to ~8000 chars to fit in context
    if (text.length > 8000) text = text.slice(0, 8000) + "... [TRUNCATED]";

    return { html: html.slice(0, 2000), text, title, meta };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { html: "", text: "", title: "", meta: {}, error: "TIMEOUT" };
    }
    return { html: "", text: "", title: "", meta: {}, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, toolId, webAnalysis, sessionId, userId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine if this is a web analysis request
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const lastUserText = typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : (Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
        : "");

    const isWebAnalysis = webAnalysis === true || isWebAnalysisRequest(lastUserText);

    // If web analysis, fetch the webpage directly and inject content
    let webpageContext = "";
    if (isWebAnalysis) {
      const urls = extractUrls(lastUserText);
      if (urls.length > 0) {
        console.log("Fetching webpage:", urls[0]);
        const page = await fetchWebpageContent(urls[0]);
        if (page.error === "AUTH_REQUIRED (401)" || page.error === "AUTH_REQUIRED (403)") {
          webpageContext = `\n\n--- WEBPAGE FETCH RESULT ---\nURL: ${urls[0]}\n⚠️ AUTHENTICATION REQUIRED (${page.error}).\n---`;
        } else if (page.error) {
          webpageContext = `\n\n--- WEBPAGE FETCH RESULT ---\nURL: ${urls[0]}\n⚠️ Could not fetch page (${page.error}).\n---`;
        } else {
          const metaStr = Object.entries(page.meta).map(([k, v]) => `  ${k}: ${v}`).join("\n");
          webpageContext = `\n\n--- WEBPAGE CONTENT ---\nURL: ${urls[0]}\nTitle: ${page.title}\nMeta:\n${metaStr}\n\nText:\n${page.text}\n--- END ---`;
        }
      }
    }

    const systemPrompt = isWebAnalysis
      ? WEB_ANALYSIS_SYSTEM_PROMPT + webpageContext
      : (toolId && TOOL_SYSTEM_PROMPTS[toolId]
        ? TOOL_SYSTEM_PROMPTS[toolId]
        : DEFAULT_SYSTEM_PROMPT);

    // Convert messages to OpenAI-style for Lovable AI Gateway (supports text + image_url)
    const openaiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Call Lovable AI Gateway
    let fullResponse = "";
    let lastError = "";
    const gwResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: openaiMessages,
        stream: false,
      }),
    });

    if (!gwResp.ok) {
      lastError = await gwResp.text();
      console.error("Lovable AI Gateway failed:", gwResp.status, lastError.slice(0, 400));
      const status = gwResp.status === 429 ? 429 : gwResp.status === 402 ? 402 : 502;
      return new Response(
        JSON.stringify({
          error: gwResp.status === 429
            ? "Rate limit exceeded, please retry shortly."
            : gwResp.status === 402
              ? "AI credits exhausted. Add credits to your workspace."
              : "AI provider failed",
          details: lastError.slice(0, 500),
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gwJson = await gwResp.json();
    fullResponse = gwJson.choices?.[0]?.message?.content ?? "";

    // Save user message and AI response to database
    if (sessionId && userId && fullResponse) {
      const supabase = getSupabaseAdmin();

      const lastUserMsg = messages[messages.length - 1];
      const userContent = typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : (Array.isArray(lastUserMsg.content)
          ? lastUserMsg.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
          : "");

      // Ensure session exists (avoid FK race with client-side background insert)
      const previewText = (userContent || "New chat").slice(0, 200);
      const titleText = (userContent || "New chat").slice(0, 60);
      const { error: sessErr } = await supabase
        .from("chat_sessions")
        .upsert(
          { id: sessionId, user_id: userId, title: titleText, preview: previewText, tool_id: toolId || null },
          { onConflict: "id", ignoreDuplicates: true }
        );
      if (sessErr) console.error("session upsert failed:", sessErr);

      const { error: userErr } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "user",
        content: userContent,
        metadata: { toolId },
      });
      if (userErr) console.error("user message insert failed:", userErr);

      const { error: aiErr } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: fullResponse,
        metadata: { toolId },
      });
      if (aiErr) console.error("assistant message insert failed:", aiErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Response saved to database" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
