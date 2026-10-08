"use client";
import { Building2, Wallet } from "lucide-react";
import { useInstitutions } from "@/features/institutions/queries";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { Id } from "@/domain/types";

interface InstitutionLogoProps {
  institutionId?: Id | null;
  /** Free-text institution ("Outra") or account name used for the fallback monogram. */
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: "size-6 rounded-[7px] text-[10px] [&_svg]:size-3.5",
  sm: "size-8 rounded-[9px] text-[11px] [&_svg]:size-4",
  md: "size-10 rounded-[11px] text-[13px] [&_svg]:size-[18px]",
  lg: "size-12 rounded-[13px] text-sm [&_svg]:size-5",
};

/** Monogram logo of an institution (decorative; the name is always rendered alongside). */
export function InstitutionLogo({ institutionId, name, size = "md", className }: InstitutionLogoProps) {
  const { data: institutions } = useInstitutions();
  const inst = institutionId != null ? institutions?.find((i) => i.id === institutionId) : undefined;
  const base = cn("grid shrink-0 place-items-center font-semibold tracking-tight", SIZES[size], className);
  if (inst?.category === "WALLET") {
    return (
      <span aria-hidden className={cn(base, "bg-[color-mix(in_srgb,#6b7a5a_18%,transparent)] text-[color-mix(in_srgb,#6b7a5a_85%,var(--ink))]")}>
        <Wallet />
      </span>
    );
  }
  if (inst) {
    return (
      <span aria-hidden className={cn(base, "text-white")} style={{ backgroundColor: inst.color }}>
        {inst.mark}
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(base, "border border-line-strong bg-surface-2 text-ink-2")}>
      {name ? initials(name) : <Building2 />}
    </span>
  );
}
