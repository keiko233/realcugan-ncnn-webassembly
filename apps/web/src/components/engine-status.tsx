import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type EngineState = "loading" | "ready" | "error";

interface EngineStatusProps {
  state: EngineState;
  onRetry?: () => void;
}

export function EngineStatus({ state, onRetry }: EngineStatusProps) {
  if (state === "ready") {
    return (
      <Badge variant="success">
        <Check />
        {m.engine_ready()}
      </Badge>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge variant="destructive">
          <AlertTriangle />
          {m.engine_error()}
        </Badge>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {m.engine_retry()}
          </Button>
        ) : null}
      </span>
    );
  }

  return (
    <Badge variant="secondary">
      <Loader2 className="animate-spin" />
      {m.engine_loading()}
    </Badge>
  );
}
