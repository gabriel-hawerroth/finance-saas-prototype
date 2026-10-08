import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  label: string;
  className?: string;
  tone?: "ink" | "positive" | "negative" | "warning" | "brand";
}

const TONES = {
  ink: "bg-ink",
  positive: "bg-positive",
  negative: "bg-negative",
  warning: "bg-warning",
  brand: "bg-brand",
};

export function Progress({ value, label, className, tone = "ink" }: ProgressProps) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", TONES[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}
