/**
 * Universal Prompt Engine — Agent Executor
 * Runs a structured plan with parallel execution for independent steps.
 */

export type AgentStep = {
  id: number;
  tool: "chat" | "image-generator" | "code-generator" | "file-creator" | "tts" | "video-generator";
  label: string;
  prompt: string;
  dependsOn?: number[]; // Step IDs this step depends on
};

export type AgentPlan = {
  title: string;
  steps: AgentStep[];
};

export type StepStatus = "pending" | "running" | "done" | "error";

export type StepResult = {
  stepId: number;
  status: StepStatus;
  output?: string;
  imageUrl?: string;
  generatedFile?: { fileName: string; content: string; mimeType: string; format: string };
  webApp?: any;
  error?: string;
};

type OnStepUpdate = (stepId: number, result: Partial<StepResult>) => void;

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };

/** Resolve {{step_N}} references in prompt text */
function resolveRefs(prompt: string, results: Map<number, StepResult>): string {
  return prompt.replace(/\{\{step_(\d+)\}\}/g, (_, n) => {
    const r = results.get(Number(n));
    return r?.output || r?.error || "[no result]";
  });
}

/** Stream a chat response and return the full text */
async function runChat(prompt: string): Promise<string> {
  const resp = await fetch(`${BASE}/functions/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok || !resp.body) throw new Error("Chat failed");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch { /* skip */ }
    }
  }
  return content;
}

async function runImageGen(prompt: string): Promise<{ output: string; imageUrl: string }> {
  const resp = await fetch(`${BASE}/functions/v1/generate-image`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, model: "flux" }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Image generation failed");

  const img = data.images?.[0];
  const url = img?.base64 ? `data:image/png;base64,${img.base64}` : img?.url || img;
  return { output: `Generated image for: ${prompt}`, imageUrl: url };
}

async function runFileCreator(prompt: string): Promise<{ output: string; generatedFile: any }> {
  const fmMatch = prompt.match(/\b(txt|pdf|md|html|css|csv|json|xml|xlsx|xls|docx)\b/i);
  const format = fmMatch?.[1]?.toLowerCase() || "txt";

  const resp = await fetch(`${BASE}/functions/v1/file-creator`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, format }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "File creation failed");

  return {
    output: data.explanation || `Created file: ${data.fileName}`,
    generatedFile: {
      fileName: data.fileName,
      content: data.content,
      mimeType: data.mimeType,
      format: data.format,
    },
  };
}

async function runCodeGen(prompt: string): Promise<{ output: string; webApp: any }> {
  const resp = await fetch(`${BASE}/functions/v1/code-generator`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }], quality: "production" }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Code generation failed");

  return {
    output: data.explanation || "Generated web application",
    webApp: {
      files: data.files,
      framework: data.framework,
      dependencies: data.dependencies || {},
      entryPoint: data.entryPoint || "index.html",
      explanation: data.explanation || "",
    },
  };
}

/** Execute a single step */
async function executeStep(
  step: AgentStep,
  results: Map<number, StepResult>,
  onUpdate: OnStepUpdate
): Promise<StepResult> {
  onUpdate(step.id, { stepId: step.id, status: "running" });
  const resolvedPrompt = resolveRefs(step.prompt, results);

  try {
    let result: Partial<StepResult> = {};

    switch (step.tool) {
      case "chat":
        result.output = await runChat(resolvedPrompt);
        break;
      case "image-generator": {
        const img = await runImageGen(resolvedPrompt);
        result = img;
        break;
      }
      case "file-creator": {
        const file = await runFileCreator(resolvedPrompt);
        result = file;
        break;
      }
      case "code-generator": {
        const code = await runCodeGen(resolvedPrompt);
        result = code;
        break;
      }
      case "tts":
        result.output = `TTS Script: ${resolvedPrompt}`;
        break;
      case "video-generator":
        result.output = `Video generation queued: ${resolvedPrompt}`;
        break;
      default:
        result.output = await runChat(resolvedPrompt);
    }

    const full: StepResult = { stepId: step.id, status: "done", ...result };
    onUpdate(step.id, full);
    return full;
  } catch (e: any) {
    const err: StepResult = { stepId: step.id, status: "error", error: e.message };
    onUpdate(step.id, err);
    return err;
  }
}

/** 
 * Detect dependencies from {{step_N}} references if not explicitly set.
 * Returns step IDs that must complete before this step can run.
 */
function getDependencies(step: AgentStep): number[] {
  if (step.dependsOn && step.dependsOn.length > 0) return step.dependsOn;
  const refs: number[] = [];
  const regex = /\{\{step_(\d+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(step.prompt)) !== null) {
    refs.push(Number(match[1]));
  }
  return refs;
}

/** Execute a full agent plan with parallel execution for independent steps */
export async function executeAgentPlan(
  plan: AgentPlan,
  onUpdate: OnStepUpdate
): Promise<Map<number, StepResult>> {
  const results = new Map<number, StepResult>();
  const completed = new Set<number>();
  const remaining = new Set(plan.steps.map((s) => s.id));

  while (remaining.size > 0) {
    // Find all steps whose dependencies are satisfied
    const ready: AgentStep[] = [];
    for (const step of plan.steps) {
      if (!remaining.has(step.id)) continue;
      const deps = getDependencies(step);
      if (deps.every((d) => completed.has(d))) {
        ready.push(step);
      }
    }

    if (ready.length === 0) {
      // Deadlock — run remaining sequentially
      for (const step of plan.steps) {
        if (!remaining.has(step.id)) continue;
        const result = await executeStep(step, results, onUpdate);
        results.set(step.id, result);
        completed.add(step.id);
        remaining.delete(step.id);
      }
      break;
    }

    // Execute ready steps in parallel
    const promises = ready.map(async (step) => {
      remaining.delete(step.id);
      const result = await executeStep(step, results, onUpdate);
      results.set(step.id, result);
      completed.add(step.id);
    });

    await Promise.all(promises);
  }

  return results;
}
