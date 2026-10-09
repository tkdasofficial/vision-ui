import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Privacy";

export const Route = createFileRoute("/docs/privacy-policy")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Privacy policy — Super Copilot" },
      { name: "description", content: "Privacy policy in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Privacy policy — Super Copilot" },
      { property: "og:description", content: "Privacy policy in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
