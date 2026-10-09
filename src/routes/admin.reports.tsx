import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Reports";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Admin · Reports — Super Copilot" },
      { name: "description", content: "Admin · Reports in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Reports — Super Copilot" },
      { property: "og:description", content: "Admin · Reports in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
