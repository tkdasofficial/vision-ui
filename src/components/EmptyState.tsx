import { useState } from "react";
import { ArrowLeft, ChevronRight, Headphones, Image, PenLine } from "lucide-react";
import type { AITool } from "@/lib/types";
import { STUDIO_CATEGORIES, type StudioCategory } from "@/lib/workflow-presets";
import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";

type Props = { tool?: AITool; onPromptClick: (prompt: string) => void };
export default function EmptyState({ tool, onPromptClick }: Props) {
  const [studio, setStudio] = useState<StudioCategory | null>(null);
  const [showStudios, setShowStudios] = useState(false);
  if (tool)
    return (
      <ConversationEmptyState className="px-6">
        <h1 className="font-sans text-2xl font-semibold">{tool.emptyStateTitle}</h1>
        <div className="mt-5 flex w-full max-w-md flex-col gap-2">
          {tool.samplePrompts.map((prompt) => (
            <Button
              key={prompt.label}
              variant="ghost"
              onClick={() => onPromptClick(prompt.prompt)}
              className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"
            >
              <prompt.icon className="size-5 shrink-0" />
              {prompt.label}
            </Button>
          ))}
        </div>
      </ConversationEmptyState>
    );
  if (studio || showStudios)
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => {
            setStudio(null);
            setShowStudios(false);
          }}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="my-5 font-sans text-2xl font-semibold">{studio?.name || "Projects"}</h1>
        <div className="flex flex-col gap-1">
          {studio
            ? studio.workflows.map((workflow) => (
                <Button
                  key={workflow.id}
                  variant="ghost"
                  onClick={() => onPromptClick(workflow.prompt)}
                  className="h-auto justify-start gap-3 whitespace-normal py-4 text-left"
                >
                  <workflow.icon className="size-5 shrink-0" />
                  <span className="flex-1">{workflow.name}</span>
                  <ChevronRight className="size-4 shrink-0" />
                </Button>
              ))
            : STUDIO_CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant="ghost"
                  onClick={() => setStudio(category)}
                  className="h-14 justify-start gap-3"
                >
                  <category.icon className="size-5" />
                  <span className="flex-1 text-left">{category.name}</span>
                  <ChevronRight className="size-4" />
                </Button>
              ))}
        </div>
      </div>
    );
  return (
    <ConversationEmptyState className="min-h-full justify-end gap-0 px-4 pb-1 pt-6 text-left sm:px-6">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="space-y-0">
          <Button
            variant="ghost"
            onClick={() =>
              document.querySelector<HTMLButtonElement>('button[title="Voice input"]')?.click()
            }
            className="h-[50px] w-full justify-start gap-3 rounded-lg px-2 text-[18px] font-normal text-secondary-foreground [&_svg]:size-[22px]"
          >
            <Headphones />
            Voice typing
          </Button>
          <Button
            variant="ghost"
            onClick={() => onPromptClick("Create an image of ")}
            className="h-[50px] w-full justify-start gap-3 rounded-lg px-2 text-[18px] font-normal text-secondary-foreground [&_svg]:size-[22px]"
          >
            <Image />
            Create an image or sticker
          </Button>
          <Button
            variant="ghost"
            onClick={() => onPromptClick("Help me write or edit ")}
            className="h-[50px] w-full justify-start gap-3 rounded-lg px-2 text-[18px] font-normal text-secondary-foreground [&_svg]:size-[22px]"
          >
            <PenLine />
            Write or edit
          </Button>
        </div>
      </div>
    </ConversationEmptyState>
  );
}
