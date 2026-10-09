import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/FeatureFlags"; from "@/components/Protected";}

export const Route = createFileRoute("/admin/feature-flags")({
  head: () => ({
    meta: [
      { title: "Admin · Feature flags — Super Copilot" },
      { name: "description", content: "Admin · Feature flags in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Feature flags — Super Copilot" },
      { property: "og:description", content: "Admin · Feature flags in Super Copilot, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
