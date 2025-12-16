import { AbodeLogo } from "@/components/abode-logo";

export function AbodeInline() {
  return (
    <span className="inline-flex items-baseline">
      <span className="sr-only">abode</span>
      <AbodeLogo className="ml-0.5 h-[0.8em] w-auto text-current" aria-hidden />
    </span>
  );
}
