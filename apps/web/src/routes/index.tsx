import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Zap } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import { UpscaleWorkbench } from "@/components/upscale-workbench";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="animate-rise py-10 sm:py-14">
        <p className="eyebrow">{m.hero_eyebrow()}</p>
        <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
          {m.hero_title_lead()}
          <span className="text-primary">{m.hero_title_emphasis()}</span>
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-relaxed">
          {m.hero_subtitle()}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="outline">
            <ShieldCheck />
            {m.hero_badge_local()}
          </Badge>
          <Badge variant="outline">
            <Zap />
            {m.hero_badge_engine()}
          </Badge>
        </div>

        <p className="text-muted-foreground mt-5 max-w-2xl text-xs leading-relaxed">
          {m.hero_notice()}
        </p>
      </section>

      <div className="animate-rise [animation-delay:120ms] pb-4">
        <UpscaleWorkbench />
      </div>
    </div>
  );
}
