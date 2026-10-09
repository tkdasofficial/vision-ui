import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Inbox";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/inbox")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Inbox — Super Copilot" },
      { name: "description", content: "Inbox in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Inbox — Super Copilot" },
      { property: "og:description", content: "Inbox in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
