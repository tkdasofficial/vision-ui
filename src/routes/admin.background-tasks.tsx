import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/BackgroundTasks";

export const Route = createFileRoute("/admin/background-tasks")({
  head: () => ({
    meta: [
      { title: "Admin · Background tasks — Super Copilot" },
      { name: "description", content: "Admin · Background tasks in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Background tasks — Super Copilot" },
      { property: "og:description", content: "Admin · Background tasks in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
