import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Compact segmented control built on Radix RadioGroup for real a11y semantics. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={ariaLabel}
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={String(option.value)}
          className={cn(
            "relative cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            "hover:text-foreground focus-within:ring-[3px] focus-within:ring-ring/40",
            "has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-sm",
            option.disabled && "pointer-events-none opacity-40",
          )}
        >
          <RadioGroupPrimitive.Item
            value={String(option.value)}
            disabled={option.disabled}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
