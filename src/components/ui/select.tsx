"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  textValue?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
}

interface SelectProps {
  id?: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  groups?: { label: string; options: SelectOption[] }[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

function Item({ option }: { option: SelectOption }) {
  return (
    <S.Item
      value={option.value}
      disabled={option.disabled}
      textValue={option.textValue ?? (typeof option.label === "string" ? option.label : option.value)}
      className="relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[var(--radius-sm)] py-1.5 pl-2 pr-8 text-sm text-ink outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2"
    >
      {option.leading}
      <S.ItemText>{option.label}</S.ItemText>
      <S.ItemIndicator className="absolute right-2">
        <Check className="size-4" />
      </S.ItemIndicator>
    </S.Item>
  );
}

export function Select({ id, value, onValueChange, options, groups, placeholder = "Selecione", disabled, invalid, className, ...aria }: SelectProps) {
  return (
    <S.Root value={value ?? ""} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger id={id} aria-invalid={invalid || undefined} className={cn(inputClass, "justify-between gap-2 text-left data-[placeholder]:text-ink-3", className)} {...aria}>
        <span className="flex min-w-0 items-center gap-2 truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="size-4 text-ink-3" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-lift)]">
          <S.Viewport className="p-1">
            {options.map((o) => (
              <Item key={o.value} option={o} />
            ))}
            {groups?.map((g) => (
              <S.Group key={g.label}>
                <S.Label className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.label}</S.Label>
                {g.options.map((o) => (
                  <Item key={o.value} option={o} />
                ))}
              </S.Group>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
