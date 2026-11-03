import { Link } from "@tanstack/react-router";
import { Info, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Theme } from "@/lib/enums";
import { LOCALE_SHORT, useLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/keiko233/realcugan-ncnn-webassembly";

type Tone = "paper" | "chrome";

function toneClass(tone: Tone): string {
  return tone === "chrome"
    ? "text-chrome-ink-2 hover:bg-white/10 hover:text-chrome-ink"
    : "text-muted-foreground hover:bg-accent hover:text-foreground";
}

function Action({
  label,
  tone,
  onClick,
  className,
  children,
}: {
  label: string;
  tone: Tone;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={cn(toneClass(tone), className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Language, about, source and theme, in one quiet row. */
export function UtilityCluster({ tone = "paper" }: { tone?: Tone }) {
  const { locale, setLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === Theme.Dark;

  return (
    <div className="flex items-center gap-0.5">
      <Action
        label={m.nav_language()}
        tone={tone}
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        className="text-[11px] font-semibold"
      >
        {LOCALE_SHORT[locale] ?? locale}
      </Action>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className={toneClass(tone)}>
            <Link to="/about" aria-label={m.action_about()}>
              <Info />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{m.action_about()}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className={toneClass(tone)}>
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label={m.action_github()}>
              <GithubIcon />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{m.action_github()}</TooltipContent>
      </Tooltip>

      <Action
        label={isDark ? m.nav_theme_to_light() : m.nav_theme_to_dark()}
        tone={tone}
        onClick={toggleTheme}
      >
        {isDark ? <Sun /> : <Moon />}
      </Action>
    </div>
  );
}
