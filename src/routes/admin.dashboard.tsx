import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Dashboard";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin · Dashboard — Super Copilot" },
      { name: "description", content: "Admin · Dashboard in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Dashboard — Super Copilot" },
      { property: "og:description", content: "Admin · Dashboard in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
