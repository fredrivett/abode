/**
 * Holds Chromium's deferred `beforeinstallprompt` event so our own install UI
 * can show the native prompt later. The event can fire before React hydrates,
 * so capture starts from `instrumentation-client.ts`, not a component.
 */

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isBeforeInstallPromptEvent(
  event: Event,
): event is BeforeInstallPromptEvent {
  return (
    "prompt" in event &&
    typeof event.prompt === "function" &&
    "userChoice" in event
  );
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  for (const listener of listeners) listener();
}

/** Starts holding the install prompt; returns a cleanup */
export function captureInstallPrompt(target: EventTarget = window): () => void {
  const onPrompt = (event: Event) => {
    if (!isBeforeInstallPromptEvent(event)) return;
    // Suppress Chrome's mini-infobar: the install banner offers it instead
    event.preventDefault();
    setDeferredPrompt(event);
  };
  const onInstalled = () => setDeferredPrompt(null);
  target.addEventListener("beforeinstallprompt", onPrompt);
  target.addEventListener("appinstalled", onInstalled);
  return () => {
    target.removeEventListener("beforeinstallprompt", onPrompt);
    target.removeEventListener("appinstalled", onInstalled);
  };
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

/** Shows the native install prompt; each deferred event can only prompt once */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  setDeferredPrompt(null);
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    // e.g. called twice on one event
    return "unavailable";
  }
}
