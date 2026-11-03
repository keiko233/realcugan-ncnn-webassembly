import { createRootRoute, Outlet } from "@tanstack/react-router";

import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export const Route = createRootRoute({
  component: RootLayout,
});

/**
 * The shell is exactly one viewport tall and never scrolls: the workbench owns
 * every pixel of it, and the about page scrolls inside its own region.
 */
function RootLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <TooltipProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <main className="min-h-0 flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
