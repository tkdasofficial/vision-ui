import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Users";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
