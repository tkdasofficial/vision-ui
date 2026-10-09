import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Terms"; from "@/components/Protected";}

export const Route = createFileRoute("/docs/terms-conditions")({
  head: () => ({
    meta: [
      { title: "Terms and conditions — Super Copilot" },
      { name: "description", content: "Terms and conditions in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Terms and conditions — Super Copilot" },
      { property: "og:description", content: "Terms and conditions in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
