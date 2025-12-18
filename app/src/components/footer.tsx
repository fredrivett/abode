import { AbodeLogo } from "./abode-logo";

export function Footer() {
  return (
    <footer className="w-full py-6 px-4 mt-auto">
      <div className="flex items-center justify-center gap-1 text-muted-foreground select-none">
        <span className="font-serif text-lg leading-none">your humble</span>
        <AbodeLogo className="h-4 w-auto mb-[0.2em]" aria-label="abode" />
      </div>
    </footer>
  );
}
