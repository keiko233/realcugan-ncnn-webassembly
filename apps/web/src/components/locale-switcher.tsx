import { m } from "@/paraglide/messages.js";
import { Segmented } from "@/components/segmented";
import { LOCALE_LABELS, useLocale, type Locale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, locales } = useLocale();

  return (
    <Segmented<Locale>
      ariaLabel={m.nav_language()}
      value={locale}
      onChange={setLocale}
      options={locales.map((item) => ({ value: item, label: LOCALE_LABELS[item] ?? item }))}
    />
  );
}
