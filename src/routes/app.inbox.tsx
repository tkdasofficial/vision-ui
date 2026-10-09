import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Inbox";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/inbox")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Inbox — Vision" },
      { name: "description", content: "Inbox in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Inbox — Vision" },
      { property: "og:description", content: "Inbox in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
