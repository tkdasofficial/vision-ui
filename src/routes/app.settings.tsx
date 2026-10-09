import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Settings";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — Vision" },
      { name: "description", content: "Settings in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Settings — Vision" },
      { property: "og:description", content: "Settings in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
