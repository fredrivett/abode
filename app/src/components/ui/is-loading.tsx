import { Loader2 } from "lucide-react";
import type { ComponentType } from "react";

import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { cn } from "@/lib/utils";

export type IsLoadingProps = {
  className?: string;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: string;
  labelClassName?: string;
};

export function IsLoading({
  className,
  icon: IconComponent,
  iconClassName,
  label,
  labelClassName,
}: IsLoadingProps) {
  const Icon = IconComponent ?? Loader2;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Icon className={cn("size-3 animate-spin", iconClassName)} />
      <span className={cn(labelClassName)}>
        {label}
        <LoadingEllipsis />
      </span>
    </span>
  );
}
