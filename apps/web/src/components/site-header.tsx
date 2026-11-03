import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import { GithubIcon } from "@/components/icons";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/keiko233/realcugan-ncnn-webassembly";

const navLinkClass =
  "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground font-display grid size-8 place-items-center rounded-lg text-sm font-bold shadow-sm">
            RC
          </span>
          <span className="font-display text-[0.95rem] font-semibold tracking-tight">
            Real-CUGAN
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className={navLinkClass}
            activeProps={{ className: cn(navLinkClass, "text-foreground") }}
          >
            {m.nav_workbench()}
          </Link>
          <Link
            to="/about"
            className={navLinkClass}
            activeProps={{ className: cn(navLinkClass, "text-foreground") }}
          >
            {m.nav_about()}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="outline" size="icon-sm" className="hidden sm:inline-flex">
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label={m.nav_github()}>
              <GithubIcon />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
