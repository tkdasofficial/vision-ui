import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Index";
import { Protected  from "@/components/Protected";}

export const Route = createFileRoute("/app/new")({
  head: () => ({
    meta: [
      { title: "New chat — Super Copilot" },
      { name: "description", content: "New chat in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "New chat — Super Copilot" },
      { property: "og:description", content: "New chat in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
