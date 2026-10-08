"use client";
import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalize } from "@/lib/text";
import { inputClass } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./menu";

export interface PickerOption {
  value: string;
  label: string;
  /** Secondary line or trailing text. */
  hint?: React.ReactNode;
  leading?: React.ReactNode;
  keywords?: string[];
  /** Visual indentation for children (subcategory, piggy bank). */
  indent?: boolean;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface PickerGroup {
  label?: string;
  options: PickerOption[];
}

interface OptionPickerProps {
  id?: string;
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  groups: PickerGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

/** Searchable single-choice picker (combobox) with grouped, rich options. */
export function OptionPicker({ id, value, onValueChange, groups, placeholder = "Selecione", searchPlaceholder = "Buscar…", emptyText = "Nada encontrado", invalid, disabled, className, ...aria }: OptionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const selected = React.useMemo(() => groups.flatMap((g) => g.options).find((o) => o.value === value), [groups, value]);
  const total = groups.reduce((s, g) => s + g.options.length, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          className={cn(inputClass, "h-11 justify-between gap-2 text-left", !selected && "text-ink-3", className)}
          {...aria}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {selected?.leading}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            {selected?.badge}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] min-w-[280px] p-0" align="start">
        <Command
          filter={(itemValue, search, keywords) => {
            const hay = normalize([itemValue, ...(keywords ?? [])].join(" "));
            return hay.includes(normalize(search)) ? 1 : 0;
          }}
        >
          {total > 7 && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-ink-3" aria-hidden />
              <Command.Input placeholder={searchPlaceholder} className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
            </div>
          )}
          <Command.List id={listId} className="scrollbar-thin max-h-[min(340px,50dvh)] overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">{emptyText}</Command.Empty>
            {groups.map((g, gi) =>
              g.options.length === 0 ? null : (
                <Command.Group
                  key={g.label ?? gi}
                  heading={g.label}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3"
                >
                  {g.options.map((o) => (
                    <Command.Item
                      key={o.value}
                      value={`${o.label} ${o.value}`}
                      keywords={o.keywords}
                      disabled={o.disabled}
                      onSelect={() => {
                        onValueChange(o.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-ink outline-none data-[disabled=true]:opacity-40 data-[selected=true]:bg-surface-2",
                        o.indent && "pl-7",
                      )}
                    >
                      {o.leading}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.hint && <span className="block truncate text-xs text-ink-3">{o.hint}</span>}
                      </span>
                      {o.badge}
                      {o.value === value && <Check className="size-4 shrink-0 text-ink" aria-hidden />}
                    </Command.Item>
                  ))}
                </Command.Group>
              ),
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
