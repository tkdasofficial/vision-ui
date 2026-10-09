import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Upgrade";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/upgrade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Upgrade — Super Copilot" },
      { name: "description", content: "Upgrade in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Upgrade — Super Copilot" },
      { property: "og:description", content: "Upgrade in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
