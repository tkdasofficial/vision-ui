import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Privacy"; from "@/components/Protected";}

export const Route = createFileRoute("/docs/privacy-policy")({
  head: () => ({
    meta: [
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
