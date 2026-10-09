import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/AdminLayout";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Super Copilot" },
      { name: "description", content: "Admin in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin — Super Copilot" },
      { property: "og:description", content: "Admin in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
