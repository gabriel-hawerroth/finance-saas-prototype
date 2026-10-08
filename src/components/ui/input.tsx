import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "flex h-10 w-full min-w-0 rounded-[var(--radius-md)] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] outline-none hover:border-ink-3 focus-visible:border-focus focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)] disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-negative sm:text-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
});
