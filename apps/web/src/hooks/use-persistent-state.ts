import { useCallback, useState } from "react";

import { StorageKey } from "@/lib/enums";

/**
 * `useState` that mirrors its value into `localStorage`.
 *
 * `decode` returns `undefined` for values that should not be restored (for
 * example an option that no longer exists), in which case the default is used.
 */
export function usePersistentState<T>(
  key: StorageKey,
  defaultValue: T,
  decode: (raw: string | null) => T | undefined,
  encode: (value: T) => string,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(
    () => decode(window.localStorage.getItem(key)) ?? defaultValue,
  );

  const update = useCallback(
    (next: T) => {
      window.localStorage.setItem(key, encode(next));
      setValue(next);
    },
    [key, encode],
  );

  return [value, update];
}

/** Builds a decoder for a numeric enum, rejecting unknown values. */
export function decodeNumericEnum<T extends number>(allowed: readonly T[]) {
  const values = new Set<number>(allowed);
  return (raw: string | null): T | undefined => {
    if (raw === null) return undefined;
    const parsed = Number(raw);
    return values.has(parsed) ? (parsed as T) : undefined;
  };
}

/** Builds a decoder for a string enum, rejecting unknown values. */
export function decodeStringEnum<T extends string>(allowed: readonly T[]) {
  const values = new Set<string>(allowed);
  return (raw: string | null): T | undefined => {
    if (raw === null) return undefined;
    return values.has(raw) ? (raw as T) : undefined;
  };
}
