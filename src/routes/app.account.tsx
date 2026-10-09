import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Account";
import { Protected  from "@/components/Protected";}

export const Route = createFileRoute("/app/account")({
  head: () => ({
    meta: [
      { title: "Account — Super Copilot" },
      { name: "description", content: "Account in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Account — Super Copilot" },
      { property: "og:description", content: "Account in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}
