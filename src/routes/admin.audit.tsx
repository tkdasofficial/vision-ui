import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/AuditLog"; from "@/components/Protected";}

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Admin · Audit log — Super Copilot" },
      { name: "description", content: "Admin · Audit log in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Audit log — Super Copilot" },
      { property: "og:description", content: "Admin · Audit log in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
