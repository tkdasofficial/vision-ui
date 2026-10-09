import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Index";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "Chat — Super Copilot" },
      { name: "description", content: "Chat in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Chat — Super Copilot" },
      { property: "og:description", content: "Chat in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
