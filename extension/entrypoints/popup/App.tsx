import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { browser } from "wxt/browser";
import logoDark from "@/assets/abode.svg";
import logoLight from "@/assets/abode-light.svg";
import {
  Button,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  LoadingEllipsis,
  Spinner,
} from "@/components/ui";
import { NotSignedInError, saveUrl } from "@/lib/api";
import { captureRenderedHtml } from "@/lib/capture";
import {
  type AuthState,
  getAuthState,
  recheckAuthState,
  signIn,
  signOut,
  verifyMfa,
} from "@/lib/auth";
import { CONFIG, isConfigured } from "@/lib/config";
import { fetchLatestBuild, isNewerBuild, type LatestBuild } from "@/lib/updates";

type Status = "loading" | AuthState;

export function App() {
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    if (!isConfigured()) return;
    setStatus(await getAuthState());
  }, []);

  // A save was refused: re-check the session, and report whether it's still
  // signed in (so the save view shows a retry rather than switching views)
  const handleSaveRejected = useCallback(async () => {
    const state = await recheckAuthState();
    setStatus(state);
    return state === "signedIn";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex items-center justify-between">
        {status === "signedIn" ? (
          <a href={CONFIG.abodeBaseUrl} target="_blank" rel="noreferrer">
            <Logo />
          </a>
        ) : (
          <Logo />
        )}
        {status === "signedIn" && (
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={async () => {
              await signOut();
              setStatus("signedOut");
            }}
          >
            Sign out
          </button>
        )}
      </header>

      {!isConfigured() ? (
        <NotConfigured />
      ) : status === "loading" ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : status === "signedOut" ? (
        <LoginView onSignedIn={refresh} />
      ) : status === "mfaRequired" ? (
        <MfaView
          onVerified={refresh}
          onCancel={async () => {
            await signOut();
            setStatus("signedOut");
          }}
        />
      ) : (
        <SaveView onRejected={handleSaveRejected} />
      )}

      {isConfigured() && <BuildFooter />}
    </div>
  );
}

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; latest: LatestBuild }
  | { status: "error"; message: string };

function BuildFooter() {
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  // Only CI builds carry a run number to compare against the latest main build;
  // a local build (number 0) just shows its SHA, no check.
  const isCiBuild = CONFIG.buildNumber > 0;

  async function check() {
    setUpdate({ status: "checking" });
    try {
      const latest = await fetchLatestBuild();
      setUpdate(
        isNewerBuild(CONFIG.buildNumber, latest.number)
          ? { status: "available", latest }
          : { status: "current" },
      );
    } catch (err) {
      setUpdate({
        status: "error",
        message: err instanceof Error ? err.message : "Check failed",
      });
    }
  }

  return (
    <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span>
          {isCiBuild ? `Build ${CONFIG.buildNumber}` : "Dev build"} ·{" "}
          <code>{CONFIG.buildSha}</code>
        </span>
        {isCiBuild &&
          (update.status === "checking" ? (
            <span className="inline-flex items-center gap-1">
              <Spinner className="size-3" /> Checking
            </span>
          ) : (
            <button
              type="button"
              onClick={check}
              className="transition-colors hover:text-foreground"
            >
              Check for updates
            </button>
          ))}
      </div>

      {update.status === "current" && (
        <span className="text-foreground">You're on the latest build.</span>
      )}
      {update.status === "available" && (
        <a
          href={update.latest.url}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline"
        >
          Build {update.latest.number} available — download &amp; reload
        </a>
      )}
      {update.status === "error" && (
        <span className="text-destructive">
          Couldn't check for updates ({update.message}).
        </span>
      )}
    </footer>
  );
}

function Logo() {
  return (
    <>
      <img src={logoDark} className="h-5 dark:hidden" alt="abode" />
      <img src={logoLight} className="hidden h-5 dark:block" alt="abode" />
    </>
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

const OTP_SLOTS = [0, 1, 2, 3, 4, 5];

function MfaView({
  onVerified,
  onCancel,
}: {
  onVerified: () => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Verifying disables (and so blurs) the input; give focus back after a wrong
  // code so the user can type the next one straight away
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  // Runs on the 6th digit (like the web form) and on submit
  async function verify(value: string) {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMfa(value);
      // Keep the form disabled until the popup has switched views
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>
      <InputOTP
        ref={inputRef}
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        aria-label="Authentication code"
        value={code}
        onChange={setCode}
        onComplete={verify}
        disabled={loading}
        autoFocus
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          {OTP_SLOTS.map((index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || code.length !== 6}>
        {loading ? <Spinner className="size-4" /> : "Verify"}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="text-center text-xs text-muted-foreground underline"
      >
        Use a different account
      </button>
    </form>
  );
}

type Tab = { id?: number; url?: string; title?: string; favIconUrl?: string };
type SaveState = "idle" | "saving" | "saved" | "error";

function SaveView({
  onRejected,
}: {
  onRejected: () => Promise<boolean>;
}) {
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
      // Capture the rendered DOM of the page being saved so the server
      // classifies against what's on screen; fall back to a bare URL save.
      const html = tab.id != null ? await captureRenderedHtml(tab.id) : null;
      await saveUrl(tab.url, html ?? undefined);
      setState("saved");
    } catch (err) {
      if (err instanceof NotSignedInError) {
        // Still signed in after a re-check: the refusal wasn't about the session
        if (await onRejected()) setError("Couldn't save. Try again.");
        else return;
      } else {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
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
          {state === "saving" ? (
            <>
              <Spinner className="size-4" />
              <span>
                Saving
                <LoadingEllipsis />
              </span>
            </>
          ) : (
            "Save this page"
          )}
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
