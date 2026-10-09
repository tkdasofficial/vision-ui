import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Index";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/chat/$chatId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Chat — Vision" },
      { name: "description", content: "Chat in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Chat — Vision" },
      { property: "og:description", content: "Chat in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
