import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/SystemSettings";

export const Route = createFileRoute("/admin/system")({
  head: () => ({
    meta: [
      { title: "Admin · System settings — Super Copilot" },
      { name: "description", content: "Admin · System settings in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · System settings — Super Copilot" },
      { property: "og:description", content: "Admin · System settings in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
