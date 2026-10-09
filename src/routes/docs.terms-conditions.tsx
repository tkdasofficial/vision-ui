import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Terms";

export const Route = createFileRoute("/docs/terms-conditions")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Terms and conditions — Vision" },
      { name: "description", content: "Terms and conditions in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Terms and conditions — Vision" },
      { property: "og:description", content: "Terms and conditions in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
