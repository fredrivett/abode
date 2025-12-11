import { AbodeLogo } from "@/components/abode-logo";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="flex flex-col items-center">
          <span className="sr-only">abode</span>
          <AbodeLogo className="h-12 w-auto text-foreground" aria-hidden />
        </h1>
        <p className="text-lg font-serif font-semibold text-muted-foreground">
          the home for your info
        </p>
      </main>
    </div>
  );
}
