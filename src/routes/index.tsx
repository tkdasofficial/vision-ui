import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Super Copilot — AI workspace" },
    { name: "description", content: "Start a conversation in your Super Copilot workspace." },
    { property: "og:title", content: "Super Copilot — AI workspace" },
    { property: "og:description", content: "Start a conversation in your Super Copilot workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/app/new" }); },
});
