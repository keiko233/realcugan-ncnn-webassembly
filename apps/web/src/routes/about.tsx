import { createFileRoute, Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import { UtilityCluster } from "@/components/utility-cluster";
import { useLocaleSubscription } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const STACK = [
  { label: m.about_stack_web, value: m.about_stack_web_value },
  { label: m.about_stack_native, value: m.about_stack_native_value },
  { label: m.about_stack_deploy, value: m.about_stack_deploy_value },
];

function AboutPage() {
  // Subscribe so a language switch re-renders the article.
  useLocaleSubscription();
  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 md:px-5">
        <Link
          to="/"
          className="text-[13px] font-bold tracking-[-0.02em] text-ink hover:text-primary"
        >
          Real-CUGAN
        </Link>
        <UtilityCluster />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-[68ch] px-5 py-9 md:py-12">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-[28px]">
            {m.about_title()}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed">{m.about_lead()}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.about_p1()}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.about_p2()}</p>

          <h2 className="mt-10 border-t border-line pt-4 text-sm font-semibold">
            {m.about_stack_title()}
          </h2>
          <dl className="mt-2">
            {STACK.map((item) => (
              <div
                key={item.label()}
                className="grid gap-1 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-4"
              >
                <dt className="text-xs text-muted-foreground">{item.label()}</dt>
                <dd className="text-sm">{item.value()}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 border-t border-line pt-4 text-sm font-semibold">
            {m.about_credits_title()}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.about_credits()}</p>
        </article>
      </div>
    </div>
  );
}
