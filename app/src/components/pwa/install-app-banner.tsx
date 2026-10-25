"use client";

import { Share, Smartphone, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type InstallOption,
  useInstallOption,
} from "@/hooks/use-install-option";
import { promptInstall } from "@/lib/pwa/install-prompt";

const DISMISSED_AT_KEY = "abode:install-banner-dismissed-at";
/** How long a dismissal hides the banner before it's offered again */
export const DISMISS_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export function isBannerSnoozed(now: number): boolean {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY));
    return dismissedAt > 0 && now - dismissedAt < DISMISS_SNOOZE_MS;
  } catch {
    return false;
  }
}

function snoozeBanner(now: number) {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(now));
  } catch {
    // Storage blocked: the banner just comes back next load
  }
}

type InstallAppBannerViewProps = {
  option: Exclude<InstallOption, null>;
  onInstall: () => void;
  onDismiss: () => void;
};

/** The banner itself, per install route — see {@link InstallAppBanner} */
export function InstallAppBannerView({
  option,
  onInstall,
  onDismiss,
}: InstallAppBannerViewProps) {
  return (
    <aside
      aria-label="Install abode"
      className="fade-in-0 slide-in-from-bottom-2 fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md animate-in items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg"
    >
      <Smartphone className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Add abode to your home screen</p>
        {option === "ios" ? (
          <p className="text-muted-foreground">
            Tap <Share className="inline size-3.5 align-[-2px]" /> Share, then{" "}
            <span className="font-medium text-foreground">
              Add to Home Screen
            </span>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">
            Opens full screen and saves from the share sheet.
          </p>
        )}
      </div>
      {option === "prompt" && (
        <Button size="sm" onClick={onInstall}>
          Install
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X />
      </Button>
    </aside>
  );
}

/**
 * Suggests installing abode on phones and tablets that aren't running it as an
 * installed app: the native prompt where the browser offers one (Android), or
 * the Share → Add to Home Screen steps on iOS. Dismissing snoozes it.
 */
export function InstallAppBanner() {
  const option = useInstallOption();
  // Hidden until the snooze is read on mount (localStorage isn't on the server)
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    setSnoozed(isBannerSnoozed(Date.now()));
  }, []);

  const visible = option !== null && !snoozed;

  useEffect(() => {
    if (visible) posthog.capture("install_banner_shown", { option });
  }, [visible, option]);

  if (!visible) return null;

  const handleInstall = async () => {
    posthog.capture("install_banner_install_clicked", { option });
    const outcome = await promptInstall();
    posthog.capture("install_prompt_result", { outcome });
    // Declined in the native prompt: don't ask again straight away
    if (outcome === "dismissed") {
      snoozeBanner(Date.now());
      setSnoozed(true);
    }
  };

  const handleDismiss = () => {
    posthog.capture("install_banner_dismissed", { option });
    snoozeBanner(Date.now());
    setSnoozed(true);
  };

  return (
    <InstallAppBannerView
      option={option}
      onInstall={handleInstall}
      onDismiss={handleDismiss}
    />
  );
}
