import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check, Sparkles, Users, Film, Image as ImageIcon, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = { projectId?: string; initialPrompt: string; sessionId?: string };

type Project = any;

const ORCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/story-orchestrator`;

const CATEGORIES = ["Horror", "Emotional", "Motivational", "Thriller", "Romance", "Mystery", "Fantasy", "Sci-Fi", "Comedy", "Drama"];

export default function StoryFlowCard({ projectId: initialProjectId, initialPrompt, sessionId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Step 1 form state
  const [topic, setTopic] = useState(initialPrompt.replace(/\b(create|generate|make|i want to make|make me)\b/gi, "").trim() || "");
  const [category, setCategory] = useState(autoCategory(initialPrompt));
  const [audience, setAudience] = useState("General audience");
  const [language, setLanguage] = useState("English");
  const [length, setLength] = useState("5 minutes");
  const [contentChoice, setContentChoice] = useState<"both" | "script" | "audio" | "generate">("generate");
  const [scriptText, setScriptText] = useState("");

  // Subscribe to project
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    supabase.from("story_projects").select("*").eq("id", projectId).maybeSingle().then(({ data }) => {
      if (active && data) setProject(data);
    });
    const ch = supabase
      .channel(`story:${projectId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "story_projects", filter: `id=eq.${projectId}` }, (payload) => {
        if (active) setProject(payload.new);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [projectId]);

  const call = useCallback(async (action: string, extra: any = {}) => {
    if (!user) return;
    setLoading(action);
    try {
      const r = await fetch(ORCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action, userId: user.id, projectId, ...extra }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      if (data.project?.id && !projectId) setProjectId(data.project.id);
      return data;
    } catch (e: any) {
      toast({ title: "Story step failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }, [user, projectId, toast]);

  // ----- Step 1: requirements form -----
  if (!projectId) {
    return (
      <Card title="Create a Story" icon={<Sparkles className="w-4 h-4" />}>
        <div className="grid gap-3">
          <Field label="Story Topic"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. A lonely lighthouse keeper" /></Field>
          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-md text-xs border ${category === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{c}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Audience"><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></Field>
            <Field label="Language"><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
            <Field label="Length"><Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g. 5 minutes" /></Field>
          </div>
          <Field label="Do you have content already?">
            <RadioGroup value={contentChoice} onValueChange={(v) => setContentChoice(v as any)} className="grid grid-cols-2 gap-2">
              {[
                ["both", "I have both"],
                ["script", "Only the script"],
                ["audio", "Only the audio"],
                ["generate", "Generate everything for me"],
              ].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent">
                  <RadioGroupItem value={v} /> {l}
                </label>
              ))}
            </RadioGroup>
          </Field>
          {(contentChoice === "both" || contentChoice === "script") && (
            <Field label="Paste your script">
              <Textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} rows={5} placeholder="Paste script text here…" />
            </Field>
          )}
          <Button
            disabled={!topic || !!loading}
            onClick={async () => {
              const res = await call("create", {
                sessionId, topic, category, audience, language, length,
                hasScript: !!scriptText, hasAudio: contentChoice === "both" || contentChoice === "audio",
                script: scriptText || undefined,
              });
              if (res?.project?.id) {
                await fetch(ORCH_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                  body: JSON.stringify({ action: "analyze", userId: user?.id, projectId: res.project.id }),
                });
              }
            }}
          >
            {loading === "create" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Start Story Creation
          </Button>
        </div>
      </Card>
    );
  }

  if (!project) return <Card title="Loading story…" icon={<Loader2 className="w-4 h-4 animate-spin" />}><div className="h-8" /></Card>;

  const s = project.status;
  const prog = project.progress || {};

  return (
    <div className="space-y-3">
      <Card title={project.title || project.topic || "Story Project"} icon={<Sparkles className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">{project.category}</Badge>
          <Badge variant="outline">{project.language}</Badge>
          <Badge variant="outline">{project.length}</Badge>
          <Badge>{labelStatus(s)}</Badge>
        </div>
      </Card>

      {/* Analyzing */}
      {s === "analyzing" && <ProgressCard label="Thinking & analyzing story structure…" />}

      {/* Analysis report */}
      {(s === "analysis_ready" || s === "characters_pending" || project.analysis?.characters?.length) && project.analysis?.characters && (
        <Card title="Story Analysis" icon={<FileText className="w-4 h-4" />}>
          <div className="space-y-2 text-sm">
            <Row k="Title" v={project.analysis.title} />
            <Row k="Estimated Duration" v={`${project.analysis.estimatedDurationMinutes ?? "?"} min`} />
            <Row k="Visual Style" v={project.analysis.visualStyle} />
            <Row k="Mood" v={(project.analysis.mood || []).join(", ")} />
            <Row k="Scenes" v={String(project.analysis.estimatedScenes ?? "?")} />
            <Row k="Images" v={String(project.analysis.estimatedImages ?? "?")} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Characters ({project.analysis.characters?.length || 0})</div>
              <ul className="text-xs space-y-0.5">
                {project.analysis.characters?.map((c: any, i: number) => <li key={i}>• <b>{c.name}</b> — {c.role}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Locations ({project.analysis.locations?.length || 0})</div>
              <ul className="text-xs space-y-0.5">
                {project.analysis.locations?.map((l: any, i: number) => <li key={i}>• {l.name}</li>)}
              </ul>
            </div>
          </div>
          {s === "analysis_ready" && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => call("approve_analysis")} disabled={!!loading}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve Analysis
              </Button>
              <Button size="sm" variant="outline" onClick={() => call("analyze")} disabled={!!loading}>
                {loading === "analyze" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Regenerate
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Characters step */}
      {s === "characters_pending" && (
        <Card title="Generate Characters" icon={<Users className="w-4 h-4" />}>
          <p className="text-xs text-muted-foreground mb-3">Will generate 4 reference angles (front, side, back, outfit) per character — {(project.analysis?.characters?.length || 0) * 4} images total.</p>
          <Button size="sm" onClick={() => call("generate_characters")} disabled={!!loading}>
            {loading === "generate_characters" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Users className="w-3.5 h-3.5 mr-1" />}
            Generate Character References
          </Button>
        </Card>
      )}
      {s === "generating_characters" && (
        <ProgressCard label={`Generating character references (${prog.done || 0}/${prog.total || 0})…`} value={prog.total ? (prog.done / prog.total) * 100 : undefined} />
      )}
      {(s === "characters_ready" || project.characters?.length > 0) && project.characters?.length > 0 && (
        <Card title={`Characters (${project.characters.length})`} icon={<Users className="w-4 h-4" />}>
          <div className="space-y-3">
            {project.characters.map((c: any, i: number) => (
              <div key={i}>
                <div className="text-sm font-medium">{c.name} <span className="text-muted-foreground font-normal text-xs">— {c.role}</span></div>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {Object.entries(c.images || {}).map(([a, url]) => url ? (
                    <img key={a} src={url as string} alt={a} className="aspect-square object-cover rounded border border-border" />
                  ) : (
                    <div key={a} className="aspect-square rounded border border-dashed border-border bg-muted/30" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {s === "characters_ready" && (
            <Button size="sm" className="mt-3" onClick={() => call("plan_scenes")} disabled={!!loading}>
              {loading === "plan_scenes" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Film className="w-3.5 h-3.5 mr-1" />}
              Plan Scenes
            </Button>
          )}
        </Card>
      )}

      {/* Scenes */}
      {(s === "scenes_ready" || project.scenes?.length > 0) && project.scenes?.length > 0 && (
        <Card title={`Scenes (${project.scenes.length})`} icon={<Film className="w-4 h-4" />}>
          <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
            {project.scenes.slice(0, 10).map((sc: any, i: number) => (
              <div key={i} className="border-l-2 border-border pl-2">
                <div className="font-medium">Scene {sc.index || i + 1}: {sc.title}</div>
                <div className="text-muted-foreground">{sc.summary}</div>
              </div>
            ))}
            {project.scenes.length > 10 && <div className="text-muted-foreground">…and {project.scenes.length - 10} more</div>}
          </div>
          {s === "scenes_ready" && (
            <Button size="sm" className="mt-3" onClick={() => call("generate_prompts")} disabled={!!loading}>
              {loading === "generate_prompts" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Generate Image Prompts
            </Button>
          )}
        </Card>
      )}

      {/* Prompts ready / review */}
      {(s === "prompts_ready" || s === "reviewed") && project.prompts?.length > 0 && (
        <Card title={`Prompts (${project.prompts.length})`} icon={<Sparkles className="w-4 h-4" />}>
          {s === "reviewed" && prog.issuesFound !== undefined && (
            <div className="text-xs text-muted-foreground mb-2">Self-review complete. {prog.issuesFound} inconsistencies corrected.</div>
          )}
          <div className="flex gap-2 flex-wrap">
            {s === "prompts_ready" && (
              <Button size="sm" variant="outline" onClick={() => call("self_review")} disabled={!!loading}>
                {loading === "self_review" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Run Self Review
              </Button>
            )}
            <Button size="sm" onClick={() => call("generate_images_batch", { mode: "batch" })} disabled={!!loading}>
              <ImageIcon className="w-3.5 h-3.5 mr-1" /> Generate (batch of 5)
            </Button>
            <Button size="sm" variant="outline" onClick={() => call("generate_images_batch", { mode: "sequential" })} disabled={!!loading}>
              Generate (sequential)
            </Button>
          </div>
        </Card>
      )}

      {/* Image generation */}
      {(s === "generating_images" || s === "done") && project.prompts?.length > 0 && (
        <Card title={`Scene Images (${prog.done || 0}/${prog.total || project.prompts.length})`} icon={<ImageIcon className="w-4 h-4" />}>
          {s === "generating_images" && (
            <Progress value={prog.total ? (prog.done / prog.total) * 100 : 0} className="mb-3" />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {project.prompts.map((p: any, i: number) => p.imageUrl ? (
              <img key={i} src={p.imageUrl} alt={`Scene ${p.sceneIndex}`} className="aspect-square object-cover rounded border border-border" />
            ) : (
              <div key={i} className="aspect-square rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">#{i + 1}</div>
            ))}
          </div>
          {s === "generating_images" && (
            <Button size="sm" className="mt-3" onClick={() => call("generate_images_batch", { mode: project.generation_mode })} disabled={!!loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Continue Next Batch
            </Button>
          )}
          {s === "done" && (
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> All images generated.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function autoCategory(prompt: string): string {
  const l = prompt.toLowerCase();
  if (/horror|scary|terror/.test(l)) return "Horror";
  if (/emotional|sad|tear/.test(l)) return "Emotional";
  if (/motivat|inspir/.test(l)) return "Motivational";
  if (/thriller|suspense/.test(l)) return "Thriller";
  if (/romance|love/.test(l)) return "Romance";
  if (/mystery|detective/.test(l)) return "Mystery";
  if (/fantasy|magic/.test(l)) return "Fantasy";
  if (/sci.?fi|space|future/.test(l)) return "Sci-Fi";
  if (/comedy|funny/.test(l)) return "Comedy";
  return "Drama";
}

function labelStatus(s: string) {
  return ({
    collecting: "Collecting",
    analyzing: "Analyzing",
    analysis_ready: "Analysis Ready",
    characters_pending: "Characters Pending",
    generating_characters: "Generating Characters",
    characters_ready: "Characters Ready",
    scenes_ready: "Scenes Ready",
    prompts_ready: "Prompts Ready",
    reviewed: "Reviewed",
    generating_images: "Generating Images",
    done: "Complete",
  } as Record<string, string>)[s] || s;
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v?: string }) {
  return <div className="flex gap-2"><span className="text-muted-foreground min-w-[120px] text-xs">{k}:</span><span className="text-xs">{v || "—"}</span></div>;
}
function ProgressCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> {label}
      </div>
      {typeof value === "number" && <Progress value={value} className="mt-2.5" />}
    </div>
  );
}
