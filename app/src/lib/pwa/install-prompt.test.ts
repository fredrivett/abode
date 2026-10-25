import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureInstallPrompt,
  hasInstallPrompt,
  promptInstall,
  subscribeInstallPrompt,
} from "./install-prompt";

function installPromptEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
}

describe("install prompt", () => {
  let target: EventTarget;
  let release: () => void;

  beforeEach(() => {
    target = new EventTarget();
    release = captureInstallPrompt(target);
  });

  afterEach(() => {
    target.dispatchEvent(new Event("appinstalled"));
    release();
  });

  it("holds the prompt and suppresses the browser's own UI", () => {
    const event = installPromptEvent("accepted");
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(hasInstallPrompt()).toBe(true);
  });

  it("ignores events without the prompt API", () => {
    target.dispatchEvent(new Event("beforeinstallprompt"));
    expect(hasInstallPrompt()).toBe(false);
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstallPrompt(listener);
    target.dispatchEvent(installPromptEvent("accepted"));
    unsubscribe();
    target.dispatchEvent(installPromptEvent("accepted"));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("prompts once and reports the outcome", async () => {
    const event = installPromptEvent("dismissed");
    target.dispatchEvent(event);
    await expect(promptInstall()).resolves.toBe("dismissed");
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(hasInstallPrompt()).toBe(false);
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("reports a prompt that fails to show as unavailable", async () => {
    const event = installPromptEvent("accepted");
    event.prompt.mockRejectedValue(new DOMException("already prompted"));
    target.dispatchEvent(event);
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("drops the prompt once installed", () => {
    target.dispatchEvent(installPromptEvent("accepted"));
    target.dispatchEvent(new Event("appinstalled"));
    expect(hasInstallPrompt()).toBe(false);
  });

  it("stops listening after cleanup", () => {
    release();
    target.dispatchEvent(installPromptEvent("accepted"));
    expect(hasInstallPrompt()).toBe(false);
  });
});
