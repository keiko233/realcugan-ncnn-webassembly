import { createFileRoute } from "@tanstack/react-router";

import { UpscaleWorkbench } from "@/components/upscale-workbench";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <UpscaleWorkbench />;
}
