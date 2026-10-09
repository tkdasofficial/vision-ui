import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Analytics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin · Analytics — Super Copilot" },
      { name: "description", content: "Admin · Analytics in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Analytics — Super Copilot" },
      { property: "og:description", content: "Admin · Analytics in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
