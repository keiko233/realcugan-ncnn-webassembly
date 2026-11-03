import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { cn } from "@/lib/utils";

export interface OptionTab<T extends string | number> {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface OptionTabsProps<T extends string | number> {
  ariaLabel: string;
  value: T;
  options: readonly OptionTab<T>[];
  onChange: (value: T) => void;
  className?: string;
  wrapperClassName?: string;
}

/**
 * One row of mutually exclusive options as a beUI segment tab: a hairline
 * track whose selected cell is filled by a spring-animated indicator, with the
 * label rolling in behind it.
 */
export function OptionTabs<T extends string | number>({
  ariaLabel,
  value,
  options,
  onChange,
  className,
  wrapperClassName,
}: OptionTabsProps<T>) {
  return (
    <Tabs
      variant="segment"
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
    >
      <TabsList
        aria-label={ariaLabel}
        wrapperClassName={cn("w-full", wrapperClassName)}
        className={cn(
          "grid w-full gap-0.5",
          options.length === 2 ? "grid-cols-2" : "grid-cols-3",
          className,
        )}
      >
        {options.map((option) => (
          <TabsTrigger
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
            title={option.title}
            className="w-full px-2 text-[13px] disabled:opacity-35"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
