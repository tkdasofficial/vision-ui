import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Analytics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin · Analytics — Vision" },
      { name: "description", content: "Admin · Analytics in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Analytics — Vision" },
      { property: "og:description", content: "Admin · Analytics in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
