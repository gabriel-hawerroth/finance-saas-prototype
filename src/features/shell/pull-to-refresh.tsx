"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;

/** Touch "pull to refresh" for the main screens on phones (§5.13). Refetches the screen's data. */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const start = React.useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    start.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current == null) return;
    const dy = e.touches[0].clientY - start.current;
    if (dy > 0 && window.scrollY <= 0) setPull(Math.min(110, dy * 0.5));
  };
  const onTouchEnd = async () => {
    if (start.current == null) return;
    start.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD * 0.6);
      await qc.refetchQueries({ queryKey: ["fin"], type: "active" });
      setRefreshing(false);
    }
    setPull(0);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div aria-hidden={!refreshing} className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-200" style={{ height: pull }}>
        <span className={cn("mt-3 grid size-9 place-items-center rounded-full bg-surface shadow-[var(--shadow-soft)]", refreshing && "animate-spin")}>
          <RotateCw className="size-4 text-ink-2" style={{ transform: `rotate(${pull * 3}deg)` }} />
        </span>
      </div>
      {refreshing && (
        <span role="status" className="sr-only">
          Atualizando
        </span>
      )}
      {children}
    </div>
  );
}
