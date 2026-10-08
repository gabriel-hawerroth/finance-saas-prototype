"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/features/prefs/store";
import { currentMonthKey, monthLabel, shiftMonthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface MonthSwitcherProps {
  value: string;
  onChange: (monthKey: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "md" | "lg";
}

/** Previous / next month navigation with a live-announced label. */
export function MonthSwitcher({ value, onChange, disabled, className, size = "md" }: MonthSwitcherProps) {
  const language = usePrefs((s) => s.language);
  const isCurrent = value === currentMonthKey();
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(shiftMonthKey(value, -1))} disabled={disabled} aria-label="Mês anterior">
        <ChevronLeft />
      </Button>
      <p aria-live="polite" className={cn("min-w-36 text-center font-display leading-none", size === "lg" ? "text-[34px] sm:text-[40px]" : "text-2xl")}>
        {monthLabel(value, language)}
      </p>
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(shiftMonthKey(value, 1))} disabled={disabled} aria-label="Próximo mês">
        <ChevronRight />
      </Button>
      {!isCurrent && (
        <Button variant="subtle" size="xs" className="ml-1" onClick={() => onChange(currentMonthKey())} disabled={disabled}>
          Hoje
        </Button>
      )}
    </div>
  );
}
