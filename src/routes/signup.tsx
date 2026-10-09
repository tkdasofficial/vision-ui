import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign up — Super Copilot" },
      { name: "description", content: "Sign up in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Sign up — Super Copilot" },
      { property: "og:description", content: "Sign up in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
