import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Prospecting";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/prospecting")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Prospecting — Vision" },
      { name: "description", content: "Prospecting in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Prospecting — Vision" },
      { property: "og:description", content: "Prospecting in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
