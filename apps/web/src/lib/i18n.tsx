import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getLocale,
  locales,
  setLocale as setParaglideLocale,
  type Locale,
} from "@/paraglide/runtime.js";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly Locale[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LOCALE_LABELS: Record<string, string> = {
  zh: "中文",
  en: "English",
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());

  const setLocale = useCallback((next: Locale) => {
    // `reload: false` keeps the current document alive so the loaded wasm
    // engine and the user's image are not lost when switching languages.
    void setParaglideLocale(next, { reload: false });
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, locales }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return context;
}

export type { Locale };
