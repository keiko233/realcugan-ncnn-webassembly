import { m } from "@/paraglide/messages.js";

const REPO_URL = "https://github.com/keiko233/realcugan-ncnn-webassembly";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/70 py-8">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono">{m.footer_note()}</p>
        <p className="flex items-center gap-2">
          <span>{m.footer_privacy()}</span>
          <span aria-hidden="true">·</span>
          <a
            className="hover:text-foreground underline underline-offset-4"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            {m.footer_source()}
          </a>
        </p>
      </div>
    </footer>
  );
}
