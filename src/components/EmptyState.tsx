import { useState } from "react";
import { ArrowLeft, ChevronRight, AudioLines, Image, PenLine, Grid2X2 } from "lucide-react";
import type { AITool } from "@/lib/types";
import { STUDIO_CATEGORIES, type StudioCategory } from "@/lib/workflow-presets";
import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";

type Props = { tool?: AITool; onPromptClick: (prompt: string) => void };
export default function EmptyState({ tool, onPromptClick }: Props) {
  const [studio, setStudio] = useState<StudioCategory | null>(null);
  const [showStudios, setShowStudios] = useState(false);
  if (tool) return <ConversationEmptyState className="px-6"><h1 className="font-sans text-2xl font-semibold">{tool.emptyStateTitle}</h1><div className="mt-5 flex w-full max-w-md flex-col gap-2">{tool.samplePrompts.map((prompt) => <Button key={prompt.label} variant="ghost" onClick={() => onPromptClick(prompt.prompt)} className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"><prompt.icon className="size-5 shrink-0" />{prompt.label}</Button>)}</div></ConversationEmptyState>;
  if (studio || showStudios) return <div className="mx-auto w-full max-w-2xl px-6 py-8"><Button variant="ghost" size="icon" aria-label="Back" onClick={() => { setStudio(null); setShowStudios(false); }}><ArrowLeft className="size-5" /></Button><h1 className="my-5 font-sans text-2xl font-semibold">{studio?.name || "Projects"}</h1><div className="flex flex-col gap-1">{studio ? studio.workflows.map((workflow) => <Button key={workflow.id} variant="ghost" onClick={() => onPromptClick(workflow.prompt)} className="h-auto justify-start gap-3 whitespace-normal py-4 text-left"><workflow.icon className="size-5 shrink-0" /><span className="flex-1">{workflow.name}</span><ChevronRight className="size-4 shrink-0" /></Button>) : STUDIO_CATEGORIES.map((category) => <Button key={category.id} variant="ghost" onClick={() => setStudio(category)} className="h-14 justify-start gap-3"><category.icon className="size-5" /><span className="flex-1 text-left">{category.name}</span><ChevronRight className="size-4" /></Button>)}</div></div>;
  return <ConversationEmptyState className="justify-end gap-0 px-3 pb-5 pt-10 text-left sm:justify-center sm:px-6 sm:pb-24">
    <div className="w-full max-w-[390px] animate-fade-in">
      <h1 className="mb-9 text-center font-sans text-2xl font-semibold">Super Copilot</h1>
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => document.querySelector<HTMLButtonElement>('button[title="Voice input"]')?.click()} className="h-14 w-full justify-start gap-4 rounded-full px-4 text-base font-normal"><AudioLines className="size-6" />Voice typing<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>
        <Button variant="ghost" onClick={() => onPromptClick("Create an image of ")} className="h-14 w-full justify-start gap-4 rounded-full px-4 text-base font-normal"><Image className="size-6" />Create an image<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>
        <Button variant="ghost" onClick={() => onPromptClick("Help me write or edit ")} className="h-14 w-full justify-start gap-4 rounded-full px-4 text-base font-normal"><PenLine className="size-6" />Write or edit<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>
        <Button variant="ghost" onClick={() => setShowStudios(true)} className="h-14 w-full justify-start gap-4 rounded-full px-4 text-base font-normal"><Grid2X2 className="size-6" />Projects<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>
      </div>
    </div>
  </ConversationEmptyState>;
}
