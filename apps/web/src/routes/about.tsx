import { createFileRoute } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const STACK = [
  { label: m.about_stack_web, value: m.about_stack_web_value },
  { label: m.about_stack_native, value: m.about_stack_native_value },
  { label: m.about_stack_deploy, value: m.about_stack_deploy_value },
];

function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">{m.nav_about()}</p>
      <h1 className="font-display animate-rise mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {m.about_title()}
      </h1>

      <div className="animate-rise mt-6 space-y-4 text-sm leading-relaxed [animation-delay:80ms]">
        <p className="text-lg">{m.about_lead()}</p>
        <p className="text-muted-foreground">{m.about_p1()}</p>
        <p className="text-muted-foreground">{m.about_p2()}</p>
      </div>

      <Card className="animate-rise mt-8 [animation-delay:160ms]">
        <CardHeader>
          <CardTitle>{m.about_stack_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-border divide-y">
            {STACK.map((item) => (
              <div key={item.label()} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs tracking-wide text-muted-foreground">
                  {item.label()}
                </dt>
                <dd className="text-sm">{item.value()}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="mt-8 space-y-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {m.about_credits_title()}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{m.about_credits()}</p>
      </div>
    </div>
  );
}
