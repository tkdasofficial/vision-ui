import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Notifications";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin · Notifications — Super Copilot" },
      { name: "description", content: "Admin · Notifications in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Notifications — Super Copilot" },
      { property: "og:description", content: "Admin · Notifications in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
