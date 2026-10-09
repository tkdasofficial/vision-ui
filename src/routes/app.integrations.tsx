import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Integrations";
import { Protected  from "@/components/Protected";}

export const Route = createFileRoute("/app/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Super Copilot" },
      { name: "description", content: "Integrations in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Integrations — Super Copilot" },
      { property: "og:description", content: "Integrations in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
