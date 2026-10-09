import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Super Copilot" },
      { name: "description", content: "Forgot password in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Forgot password — Super Copilot" },
      { property: "og:description", content: "Forgot password in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
