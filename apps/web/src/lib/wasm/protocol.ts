import { z } from "zod";

import { CallbackEventType } from "../enums";

/**
 * The native side prints one JSON object per line prefixed with `$CALLBACK$`
 * (see `native/src/main.cpp`). This schema is the single source of truth for
 * that wire format on the TypeScript side; unknown or malformed lines are
 * ignored rather than crashing the UI.
 */
export const CALLBACK_PREFIX = "$CALLBACK$";

export const progressEventSchema = z.object({
  eventType: z.literal(CallbackEventType.Progress),
  total_cost: z.number(),
  tile_cost: z.number(),
  progress_rate: z.number(),
  remaining_time: z.number(),
});

export const finishEventSchema = z.object({
  eventType: z.literal(CallbackEventType.End),
  image_id: z.number(),
  cost: z.number(),
});

export const callbackEventSchema = z.discriminatedUnion("eventType", [
  progressEventSchema,
  finishEventSchema,
]);

export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type FinishEvent = z.infer<typeof finishEventSchema>;
export type CallbackEvent = z.infer<typeof callbackEventSchema>;

export function parseCallbackLine(line: string): CallbackEvent | null {
  if (!line.startsWith(CALLBACK_PREFIX)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(line.slice(CALLBACK_PREFIX.length));
  } catch {
    return null;
  }

  const result = callbackEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}
