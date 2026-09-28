"use client";

import { type ReactNode, useId } from "react";
import { Switch } from "@/components/ui/switch";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id}>{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function NumberSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between">
        {label}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="w-16 rounded border bg-transparent px-1 text-right tabular-nums"
        />
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
        className="w-full accent-foreground"
      />
    </label>
  );
}
