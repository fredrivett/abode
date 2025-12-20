import Link from "next/link";
import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex w-full items-center justify-between p-4">
        <Link
          href="/"
          className="opacity-50 transition-opacity hover:opacity-100"
        >
          <span className="sr-only">abode</span>
          <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
        </Link>
        <ThemeToggle />
      </header>
      {children}
    </>
  );
}
