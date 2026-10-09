import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Reports";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin · Reports — Vision" },
      { name: "description", content: "Admin · Reports in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Reports — Vision" },
      { property: "og:description", content: "Admin · Reports in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
