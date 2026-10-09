import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Log in — Super Copilot" },
      { name: "description", content: "Log in in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Log in — Super Copilot" },
      { property: "og:description", content: "Log in in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
