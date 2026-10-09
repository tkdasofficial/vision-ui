import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Reset password — Vision" },
      { name: "description", content: "Reset password in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Reset password — Vision" },
      { property: "og:description", content: "Reset password in Vision, your all-in-one AI workspace." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}
