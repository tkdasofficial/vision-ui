import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Announcements"; from "@/components/Protected";}

export const Route = createFileRoute("/admin/announcements")({
  head: () => ({
    meta: [
      { title: "Admin · Announcements — Super Copilot" },
      { name: "description", content: "Admin · Announcements in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Announcements — Super Copilot" },
      { property: "og:description", content: "Admin · Announcements in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
