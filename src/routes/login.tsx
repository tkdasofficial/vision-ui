import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth"; from "@/components/Protected";}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
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
