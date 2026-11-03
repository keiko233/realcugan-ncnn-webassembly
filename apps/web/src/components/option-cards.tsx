import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface OptionCard<T extends string | number> {
  value: T;
  label: string;
  caption?: string;
  disabled?: boolean;
}

interface OptionCardsProps<T extends string | number> {
  options: readonly OptionCard<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Selectable cards with a label and a short explanation. */
export function OptionCards<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: OptionCardsProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={ariaLabel}
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
      className={cn("grid gap-2 sm:grid-cols-3", className)}
    >
      {options.map((option) => (
        <label
          key={String(option.value)}
          className={cn(
            "group relative flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-[border-color,background-color,box-shadow]",
            "hover:border-primary/40 hover:bg-accent/40",
            "focus-within:ring-[3px] focus-within:ring-ring/40",
            "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/[0.06] has-[[data-state=checked]]:shadow-sm",
            option.disabled && "pointer-events-none opacity-45",
          )}
        >
          <RadioGroupPrimitive.Item
            value={String(option.value)}
            disabled={option.disabled}
            className="sr-only"
          />
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-semibold tracking-tight">
              {option.label}
            </span>
            <Check className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-has-[[data-state=checked]]:opacity-100" />
          </span>
          {option.caption ? (
            <span className="text-muted-foreground text-xs leading-relaxed">{option.caption}</span>
          ) : null}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
