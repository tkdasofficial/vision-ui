import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/ChatSessions";

export const Route = createFileRoute("/admin/chat-sessions")({
  head: () => ({
    meta: [
      { title: "Admin · Chat sessions — Super Copilot" },
      { name: "description", content: "Admin · Chat sessions in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Chat sessions — Super Copilot" },
      { property: "og:description", content: "Admin · Chat sessions in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
