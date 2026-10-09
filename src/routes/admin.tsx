import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/AdminLayout";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin — Vision" },
      { name: "description", content: "Admin in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin — Vision" },
      { property: "og:description", content: "Admin in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
