import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Settings";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Super Copilot" },
      { name: "description", content: "Settings in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Settings — Super Copilot" },
      { property: "og:description", content: "Settings in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
