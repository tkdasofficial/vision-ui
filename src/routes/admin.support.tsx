import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Support";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin · Support inbox — Super Copilot" },
      { name: "description", content: "Admin · Support inbox in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Support inbox — Super Copilot" },
      { property: "og:description", content: "Admin · Support inbox in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
