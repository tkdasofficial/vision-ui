import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Forgot password — Vision" },
      { name: "description", content: "Forgot password in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Forgot password — Vision" },
      { property: "og:description", content: "Forgot password in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
