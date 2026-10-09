import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Reset password — Super Copilot" },
      { name: "description", content: "Reset password in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Reset password — Super Copilot" },
      { property: "og:description", content: "Reset password in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
