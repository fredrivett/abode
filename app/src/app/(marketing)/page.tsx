import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-8 text-center">
        <span className="text-6xl">🏠</span>
        <h1 className="text-4xl font-semibold tracking-tight">abode</h1>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <a href="/signup">Get Started</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/login">Sign In</a>
          </Button>
        </div>
      </main>
    </div>
  );
}
