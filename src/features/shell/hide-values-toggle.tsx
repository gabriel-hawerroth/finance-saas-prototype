"use client";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/menu";
import { useNavT } from "@/features/i18n/nav";
import { usePrefs } from "@/features/prefs/store";

/** Global "hide values" toggle (§5.11). */
export function HideValuesToggle({ size = "icon-sm" }: { size?: "icon-sm" | "icon" }) {
  const t = useNavT();
  const showValues = usePrefs((s) => s.showValues);
  const set = usePrefs((s) => s.set);
  const label = showValues ? t("hideValues") : t("showValues");
  return (
    <Tooltip content={`${label} (H)`}>
      <Button variant="ghost" size={size} aria-label={label} aria-pressed={!showValues} onClick={() => set({ showValues: !showValues })}>
        {showValues ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      </Button>
    </Tooltip>
  );
}
