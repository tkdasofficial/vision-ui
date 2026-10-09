import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getGeminiKeys(): string[] {
  const keys: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
    if (k) keys.push(k);
  }
  return keys;
}

async function updateTask(supabase: any, taskId: string, data: Record<string, any>) {
  await supabase
    .from("background_tasks")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", taskId);
}

// ─── Chat task: call Gemini non-streaming, store full result ───
async function runChatTask(supabase: any, taskId: string, input: any) {
  await updateTask(supabase, taskId, { status: "running", progress: 10 });

  const geminiKeys = getGeminiKeys();
  const { messages, toolId, webAnalysis, systemPrompt } = input;

  const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
    "script-writer": "You are an expert AI Script Writer for video creators.",
    "thumbnail-designer": "You are an expert AI Thumbnail Designer.",
    "seo-optimizer": "You are an expert AI SEO Optimizer.",
    "image-generator": "You are an expert AI Image Creator assistant.",
    "content-optimizer": "You are a comprehensive Content Optimizer AI.",
    "content-analyzer": "You are an expert Content Analyzer AI.",
  };

  const sysPrompt = systemPrompt || (toolId && TOOL_SYSTEM_PROMPTS[toolId])
    ? TOOL_SYSTEM_PROMPTS[toolId] || ""
    : "You are Super Copilot, a powerful AI assistant for content creators.";

  // Convert messages to Gemini format
  const geminiContents: any[] = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (typeof msg.content === "string") {
      geminiContents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const part of msg.content) {
        if (part.type === "text") parts.push({ text: part.text });
        else if (part.type === "image_url" && part.image_url?.url?.startsWith("data:")) {
          const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
      geminiContents.push({ role, parts });
    }
  }

  const body: any = {
    system_instruction: { parts: [{ text: sysPrompt }] },
    contents: geminiContents,
  };
  if (webAnalysis) body.tools = [{ google_search: {} }];

  await updateTask(supabase, taskId, { progress: 30 });

  let resultText = "";
  for (const key of geminiKeys) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (r.ok) {
        const data = await r.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        resultText = parts.map((p: any) => p.text || "").join("");
        break;
      }
      if (r.status !== 429 && r.status !== 503) {
        const err = await r.text();
        throw new Error(`Gemini ${r.status}: ${err.slice(0, 200)}`);
      }
      await r.text(); // consume body
    } catch (e) {
      console.warn("Gemini key failed:", e);
    }
  }

  // Groq fallback
  if (!resultText) {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (GROQ_API_KEY) {
      const groqMessages = [
        { role: "system", content: sysPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content :
            (Array.isArray(m.content) ? m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") : ""),
        })),
      ];
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: groqMessages }),
      });
      if (r.ok) {
        const data = await r.json();
        resultText = data.choices?.[0]?.message?.content || "";
      } else {
        await r.text();
      }
    }
  }

  if (!resultText) throw new Error("All AI providers failed");

  await updateTask(supabase, taskId, {
    status: "done",
    progress: 100,
    result: { type: "chat", content: resultText },
  });
}

// ─── Image generation task (Lovable AI) ───
async function runImageTask(supabase: any, taskId: string, input: any) {
  await updateTask(supabase, taskId, { status: "running", progress: 10 });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Enhance prompt via Lovable AI (Gemini)
  let enhancedPrompt = input.prompt;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Rewrite the user's image request as a single detailed image-generation prompt. Output only the prompt." },
          { role: "user", content: input.prompt },
        ],
      }),
    });
    if (r.ok) {
      const data = await r.json();
      enhancedPrompt = data.choices?.[0]?.message?.content?.trim() || input.prompt;
    }
  } catch { /* fall back to raw prompt */ }

  await updateTask(supabase, taskId, { progress: 40 });

  const SIZE_BY_RATIO: Record<string, string> = {
    "1:1": "1024x1024", "16:9": "1536x1024", "4:3": "1536x1024",
    "9:16": "1024x1536", "3:4": "1024x1536",
  };
  const size = SIZE_BY_RATIO[input.aspect_ratio || "1:1"] || "1024x1024";

  const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: enhancedPrompt,
      size,
      quality: "low",
      n: 1,
    }),
  });

  if (!imgResp.ok) {
    const err = await imgResp.text();
    throw new Error(`Image generation failed: ${err.slice(0, 200)}`);
  }

  await updateTask(supabase, taskId, { progress: 90 });
  const imgData = await imgResp.json();
  const first = imgData?.data?.[0];
  const imageUrl = first?.b64_json
    ? `data:image/png;base64,${first.b64_json}`
    : first?.url;
  if (!imageUrl) throw new Error("No image generated");

  await updateTask(supabase, taskId, {
    status: "done",
    progress: 100,
    result: { type: "image", imageUrl, prompt: enhancedPrompt },
  });
}

// ─── Code generation task ───
async function runCodeTask(supabase: any, taskId: string, input: any) {
  await updateTask(supabase, taskId, { status: "running", progress: 10 });

  // Call the existing code-generator edge function internally
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/code-generator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: input.messages || [{ role: "user", content: input.prompt }],
      projectState: input.projectState,
      conversationHistory: input.conversationHistory,
      quality: input.quality || "production",
    }),
  });

  await updateTask(supabase, taskId, { progress: 60 });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Code generation failed");

  await updateTask(supabase, taskId, {
    status: "done",
    progress: 100,
    result: {
      type: "code",
      files: data.files,
      framework: data.framework,
      dependencies: data.dependencies,
      entryPoint: data.entryPoint,
      explanation: data.explanation,
    },
  });
}

// ─── File creation task ───
async function runFileTask(supabase: any, taskId: string, input: any) {
  await updateTask(supabase, taskId, { status: "running", progress: 10 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/file-creator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt: input.prompt, format: input.format }),
  });

  await updateTask(supabase, taskId, { progress: 60 });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "File creation failed");

  await updateTask(supabase, taskId, {
    status: "done",
    progress: 100,
    result: {
      type: "file",
      fileName: data.fileName,
      content: data.content,
      mimeType: data.mimeType,
      format: data.format,
      explanation: data.explanation,
    },
  });
}

// ─── Agent plan task ───
async function runAgentTask(supabase: any, taskId: string, input: any) {
  await updateTask(supabase, taskId, { status: "running", progress: 5 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  // Step 1: Get the plan
  const planResp = await fetch(`${SUPABASE_URL}/functions/v1/agent-planner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt: input.prompt }),
  });

  const plan = await planResp.json();
  if (!planResp.ok || !plan.steps?.length) throw new Error(plan.error || "Planning failed");

  await updateTask(supabase, taskId, {
    progress: 10,
    result: { type: "agent", plan, stepResults: [] },
  });

  // Step 2: Execute each step sequentially
  const stepResults: any[] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const progress = 10 + Math.floor((i / plan.steps.length) * 85);
    await updateTask(supabase, taskId, { progress });

    try {
      let stepResult: any = { stepId: step.id, tool: step.tool, label: step.label };

      // Resolve references to previous steps
      let prompt = step.prompt;
      for (const prev of stepResults) {
        const ref = `{{step_${prev.stepId}}}`;
        if (prompt.includes(ref)) {
          prompt = prompt.replace(ref, prev.output || "");
        }
      }

      if (step.tool === "chat") {
        // Use Gemini directly
        const geminiKeys = getGeminiKeys();
        for (const key of geminiKeys) {
          try {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
              }
            );
            if (r.ok) {
              const data = await r.json();
              stepResult.output = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              stepResult.status = "done";
              break;
            }
            await r.text();
          } catch { /* next key */ }
        }
      } else if (step.tool === "image-generator") {
        const imgTaskId = crypto.randomUUID();
        await runImageTask(supabase, taskId, { prompt, aspect_ratio: "1:1" });
        // Get the result we just wrote
        const { data: taskData } = await supabase.from("background_tasks").select("result").eq("id", taskId).single();
        stepResult.output = taskData?.result?.imageUrl || "";
        stepResult.imageUrl = stepResult.output;
        stepResult.status = "done";
        // Restore running status for parent
        await updateTask(supabase, taskId, { status: "running" });
      } else if (step.tool === "code-generator") {
        const codeResp = await fetch(`${SUPABASE_URL}/functions/v1/code-generator`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }], quality: "production" }),
        });
        const codeData = await codeResp.json();
        if (codeResp.ok) {
          stepResult.output = codeData.explanation || "Code generated";
          stepResult.webApp = codeData;
          stepResult.status = "done";
        } else {
          stepResult.error = codeData.error;
          stepResult.status = "error";
        }
      } else if (step.tool === "file-creator") {
        const fileResp = await fetch(`${SUPABASE_URL}/functions/v1/file-creator`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ prompt }),
        });
        const fileData = await fileResp.json();
        if (fileResp.ok) {
          stepResult.output = fileData.explanation || "File created";
          stepResult.file = fileData;
          stepResult.status = "done";
        } else {
          stepResult.error = fileData.error;
          stepResult.status = "error";
        }
      } else {
        stepResult.output = `Tool "${step.tool}" executed`;
        stepResult.status = "done";
      }

      if (!stepResult.status) stepResult.status = "done";
      stepResults.push(stepResult);

      // Update with intermediate results
      await updateTask(supabase, taskId, {
        result: { type: "agent", plan, stepResults: [...stepResults] },
      });
    } catch (e: any) {
      stepResults.push({ stepId: step.id, tool: step.tool, label: step.label, status: "error", error: e.message });
    }
  }

  await updateTask(supabase, taskId, {
    status: "done",
    progress: 100,
    result: { type: "agent", plan, stepResults },
  });
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: "taskId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the task
    const { data: task, error: fetchErr } = await supabase
      .from("background_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.status !== "pending") {
      return new Response(JSON.stringify({ error: "Task already processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in background (respond immediately)
    const processPromise = (async () => {
      try {
        switch (task.task_type) {
          case "chat":
            await runChatTask(supabase, taskId, task.input);
            break;
          case "image":
            await runImageTask(supabase, taskId, task.input);
            break;
          case "code":
            await runCodeTask(supabase, taskId, task.input);
            break;
          case "file":
            await runFileTask(supabase, taskId, task.input);
            break;
          case "agent":
            await runAgentTask(supabase, taskId, task.input);
            break;
          default:
            await runChatTask(supabase, taskId, task.input);
        }

        // Save result as chat message
        if (task.session_id) {
          const { data: taskResult } = await supabase
            .from("background_tasks")
            .select("result")
            .eq("id", taskId)
            .single();

          if (taskResult?.result) {
            const r = taskResult.result;
            const msgData: any = {
              session_id: task.session_id,
              role: "assistant",
              content: r.content || r.explanation || `Task completed: ${task.task_type}`,
              metadata: { background_task_id: taskId, task_type: task.task_type, result: r },
            };
            if (r.imageUrl) msgData.image_url = r.imageUrl;
            await supabase.from("chat_messages").insert(msgData);
          }
        }
      } catch (e: any) {
        console.error("Task execution error:", e);
        await updateTask(supabase, taskId, {
          status: "error",
          error: e.message || "Unknown error",
        });
      }
    })();

    // Use waitUntil-like pattern: don't await, let it run in background
    // Edge functions will keep running until completion
    processPromise.catch((e) => console.error("Background task crashed:", e));

    // But we also need to ensure the function doesn't exit early
    // So we actually await it
    await processPromise;

    return new Response(JSON.stringify({ ok: true, taskId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("task-worker error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
