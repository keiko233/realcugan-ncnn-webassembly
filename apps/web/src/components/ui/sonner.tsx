import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { Theme } from "@/lib/enums";
import { useTheme } from "@/lib/theme";

function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme === Theme.Dark ? "dark" : "light"}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
