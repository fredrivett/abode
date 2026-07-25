import { type FormEvent, useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import logoDark from "@/assets/abode.svg";
import logoLight from "@/assets/abode-light.svg";
import { Button, Input, Spinner } from "@/components/ui";
import { NotSignedInError, saveUrl } from "@/lib/api";
import { getSession, signIn, signOut } from "@/lib/auth";
import { CONFIG, isConfigured } from "@/lib/config";

type Status = "loading" | "signedOut" | "ready";

export function App() {
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    if (!isConfigured()) return;
    const session = await getSession();
    setStatus(session ? "ready" : "signedOut");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex items-center justify-between">
        <img src={logoDark} className="h-5 dark:hidden" alt="abode" />
        <img src={logoLight} className="hidden h-5 dark:block" alt="abode" />
        {status === "ready" && (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={async () => {
              await signOut();
              setStatus("signedOut");
            }}
          >
            Sign out
          </Button>
        )}
      </header>

      {!isConfigured() ? (
        <NotConfigured />
      ) : status === "loading" ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : status === "signedOut" ? (
        <LoginView onSignedIn={() => setStatus("ready")} />
      ) : (
        <SaveView onSignedOut={() => setStatus("signedOut")} />
      )}
    </div>
  );
}

function NotConfigured() {
  return (
    <p className="text-sm text-muted-foreground">
      Extension not configured. Set <code>WXT_SUPABASE_ANON_KEY</code> and{" "}
      <code>WXT_SUPABASE_URL</code> in <code>.env</code> and rebuild.
    </p>
  );
}

function LoginView({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Sign in to save to your abode.
      </p>
      <Input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? <Spinner className="size-4" /> : "Sign in"}
      </Button>
      <a
        href={`${CONFIG.abodeBaseUrl}/signup`}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-muted-foreground underline"
      >
        Don't have an account? Sign up
      </a>
    </form>
  );
}

type Tab = { url?: string; title?: string; favIconUrl?: string };
type SaveState = "idle" | "saving" | "saved" | "error";

function SaveView({ onSignedOut }: { onSignedOut: () => void }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([active]) => setTab(active ?? null));
  }, []);

  async function handleSave() {
    if (!tab?.url) return;
    setState("saving");
    setError(null);
    try {
      await saveUrl(tab.url);
      setState("saved");
    } catch (err) {
      if (err instanceof NotSignedInError) {
        onSignedOut();
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't save");
      setState("error");
    }
  }

  const saveable = Boolean(tab?.url?.startsWith("http"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
        {tab?.favIconUrl ? (
          <img src={tab.favIconUrl} className="size-4 shrink-0" alt="" />
        ) : (
          <div className="size-4 shrink-0 rounded-sm bg-muted" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {tab?.title ?? "Current tab"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {tab?.url ?? ""}
          </p>
        </div>
      </div>

      {state === "saved" ? (
        <Button variant="secondary" disabled>
          <CheckIcon /> Saved
        </Button>
      ) : (
        <Button onClick={handleSave} disabled={!saveable || state === "saving"}>
          {state === "saving" ? <Spinner className="size-4" /> : "Save this page"}
        </Button>
      )}

      {!saveable && (
        <p className="text-xs text-muted-foreground">
          This page can't be saved. Open a normal web page and try again.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-center text-xs text-muted-foreground">
        Or right-click a link, image, or selection to save just that.
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
