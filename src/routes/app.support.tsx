import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Support";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/support")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Support — Super Copilot" },
      { name: "description", content: "Support in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Support — Super Copilot" },
      { property: "og:description", content: "Support in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
