import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Integrations";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Integrations — Vision" },
      { name: "description", content: "Integrations in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Integrations — Vision" },
      { property: "og:description", content: "Integrations in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
