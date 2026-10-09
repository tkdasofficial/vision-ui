import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Users"; from "@/components/Protected";}

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Admin · Users — Super Copilot" },
      { name: "description", content: "Admin · Users in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Users — Super Copilot" },
      { property: "og:description", content: "Admin · Users in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
