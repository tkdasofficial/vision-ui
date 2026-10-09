import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Prospecting";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/prospecting")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Prospecting — Super Copilot" },
      { name: "description", content: "Prospecting in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Prospecting — Super Copilot" },
      { property: "og:description", content: "Prospecting in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
