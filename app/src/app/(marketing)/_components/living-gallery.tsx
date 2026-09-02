"use client";

import { AppWindow, ClipboardPaste, Upload } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getModifierKeySymbol } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { BrowserChrome } from "./browser-chrome";
import { DragDropDemo } from "./drag-drop-demo";
import { EssayPage } from "./essay-page";
import { ExtensionPopup, type SaveState } from "./extension-popup";
import {
  CardBody,
  faceClass,
  faceStyle,
  hoverClass,
  Intelligence,
} from "./gallery-card";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";
import { Highlight } from "./highlight";
import { PasteKeys } from "./paste-keys";
import { StepRail } from "./step-rail";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// The three ways things get into abode.
const STEPS = [
  {
    id: "clip",
    icon: AppWindow,
    label: "save from anywhere",
    body: "save whatever you're browsing with our browser extension, without ever leaving the page.",
  },
  {
    id: "drop",
    icon: Upload,
    label: "drag & drop",
    body: "drop an image or file straight onto abode. it uploads and files itself.",
  },
  {
    id: "paste",
    icon: ClipboardPaste,
    label: "paste a link",
    body: "{paste} a tweet anywhere in abode — it grabs the link and builds the card.",
  },
];

// Capture phase scroll budget (× viewport height) and the fraction of it spent
// scooting the wall left before the steps begin.
const CAPTURE_VH = 2.2;
const SCOOT_FRAC = 0.22;

// Width of a single step's scroll band, as a fraction of the capture budget.
const STEP_BAND = (1 - SCOOT_FRAC) / STEPS.length;

// Map overall capture progress (`cap`, 0→1) to the active step index and how far
// through that step's band we've scrolled (`progress`, 0→1). Both the scroll
// handler (active step + indicator fill) and scrollToStep derive from this.
export function stepFromCap(cap: number): { index: number; progress: number } {
  const raw = (cap - SCOOT_FRAC) / STEP_BAND;
  const index = Math.min(STEPS.length - 1, Math.max(0, Math.floor(raw)));
  return { index, progress: clamp01(raw - index) };
}

// The "save from anywhere" (browser extension) step — its demo frames the wall.
const EXTENSION_STEP = STEPS.findIndex((s) => s.id === "clip");

// The extension vignette: while the "save from anywhere" step is active it
// auto-plays — switch to the essay tab, open the extension popup, save, then
// switch back to the abode tab. Reset to "idle" whenever the step deactivates.
type VignettePhase =
  | "idle" // abode tab, grid
  | "essay" // switched to the essay tab
  | "popup" // extension popup open
  | "saving" // save in progress
  | "saved" // save complete
  | "returning" // back on the abode tab, the saved card loading in
  | "landed"; // saved card resolved, holding

// Milliseconds each phase waits before advancing to the next. "landed" has no
// entry, so the vignette holds there until the step deactivates.
const VIGNETTE_TIMELINE: Partial<Record<VignettePhase, number>> = {
  idle: 1100,
  essay: 1700,
  popup: 1500,
  saving: 1500,
  saved: 1600,
  returning: 1400,
};
const NEXT_PHASE: Partial<Record<VignettePhase, VignettePhase>> = {
  idle: "essay",
  essay: "popup",
  popup: "saving",
  saving: "saved",
  saved: "returning",
  returning: "landed",
};

// Demo cards land in the wall directly (they don't fly in from the hero), so
// their scatter config is unused — but the type requires it.
const NO_SCATTER = {
  x: 0,
  y: 0,
  scale: 1,
  blur: 0,
  opacity: 1,
  rot: 0,
  z: 0,
  amp: 0,
  period: 1000,
  phase: 0,
} as const;

// The article the extension vignette "saves" — deliberately NOT one of the
// wall's cards, so it genuinely appears (loads in) after saving.
const SAVED_CARD: GalleryCard = {
  kind: "article",
  id: "meat-proxy",
  title: "Don't be a meat proxy",
  domain: "gruhn.me",
  author: "Niklas Gruhn",
  readingTime: 3,
  insight: { kindLabel: "article", tags: ["ai", "writing", "blog"] },
  scatter: NO_SCATTER,
};

// The image the drag & drop vignette drops onto the wall.
const DROP_CARD: GalleryCard = {
  kind: "image",
  id: "bo-kaap-car",
  src: "/gallery/bo-kaap-car.jpg",
  width: 1200,
  height: 1599,
  title: "Bo-Kaap street",
  insight: {
    kindLabel: "photo",
    objects: ["car", "house", "street", "building"],
    colors: [
      { hex: "#EC6A93", name: "pink" },
      { hex: "#6FBF3B", name: "green" },
      { hex: "#3FA9E0", name: "blue" },
    ],
    tags: ["photography", "travel", "colourful", "architecture"],
  },
  scatter: NO_SCATTER,
};

// The "drag & drop" step — its demo drops an image onto the wall.
const DROP_STEP = STEPS.findIndex((s) => s.id === "drop");

// The drag & drop vignette: a file is dragged over the wall, dropped, and grows
// in as a new card.
type DropPhase =
  | "idle" // nothing yet
  | "dragging" // file held over the dropzone
  | "dropped" // released — uploading
  | "landed"; // image grown into the wall
const DROP_TIMELINE: Partial<Record<DropPhase, number>> = {
  idle: 700,
  dragging: 1600,
  dropped: 600,
};
const DROP_NEXT: Partial<Record<DropPhase, DropPhase>> = {
  idle: "dragging",
  dragging: "dropped",
  dropped: "landed",
};

// The tweet the paste vignette pastes onto the wall.
const PASTE_CARD: GalleryCard = {
  kind: "tweet",
  id: "dylan-tweet",
  author: "Dylan O'Sullivan",
  handle: "DylanoA4",
  avatar: "/gallery/dylan-avatar.jpg",
  text: "I walk somewhere, I run someplace, I lift something heavy, I eat something healthy, I read something good, I write something down, and only then do I take my bad mood seriously",
  insight: { kindLabel: "tweet", tags: ["habits", "routine", "wellbeing"] },
  scatter: NO_SCATTER,
};

// The "paste a link" step — its demo pastes a tweet onto the wall.
const PASTE_STEP = STEPS.findIndex((s) => s.id === "paste");

// The paste vignette: the paste shortcut is shown, and a tweet pastes in.
type PastePhase =
  | "idle" // nothing yet
  | "keys" // paste shortcut shown at the bottom of the screen
  | "pasted" // tweet mounts
  | "landed"; // tweet grown into the wall
const PASTE_TIMELINE: Partial<Record<PastePhase, number>> = {
  idle: 700,
  keys: 1500,
  pasted: 500,
};
const PASTE_NEXT: Partial<Record<PastePhase, PastePhase>> = {
  idle: "keys",
  keys: "pasted",
  pasted: "landed",
};

// Keep a card mounted through its exit: stays true while `active`, then holds
// for `ms` after it flips false so the card can animate out (grow-in reversed)
// before it unmounts.
function useExitDelay(active: boolean, ms: number) {
  const [rendered, setRendered] = useState(active);
  useEffect(() => {
    if (active) {
      setRendered(true);
      return;
    }
    const t = setTimeout(() => setRendered(false), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return rendered;
}

// Latch a capture's completion: turns true once `landed` happens and stays true
// (so its card carries forward) until `active` goes false — i.e. you scroll
// back before its step. A card scrolled past before it lands never latches.
function useLandedLatch(landed: boolean, active: boolean) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (landed) setDone(true);
    else if (!active) setDone(false);
  }, [landed, active]);
  return done;
}

// A demo card that grows into the wall (height 0fr → 1fr + fade, like the real
// grid's ItemFrame) and, when it leaves, reverses that to grow out. The inner
// box is pinned so it lays out once instead of reflowing on every frame.
function GrowInCard({ card, grown }: { card: GalleryCard; grown: boolean }) {
  return (
    <li className="group relative break-inside-avoid">
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: grown ? "1fr" : "0fr",
          opacity: grown ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(faceClass(card), hoverClass(card))}
            style={faceStyle(card)}
          >
            <CardBody card={card} />
            <Intelligence card={card} />
          </div>
        </div>
      </div>
    </li>
  );
}

export function LivingGallery() {
  // The whole choreography (fly-in + capture) is a desktop (lg+) treatment and
  // off under reduced-motion. Off by default so SSR matches the static grid.
  const [effectOn, setEffectOn] = useState(false);
  // Cards have flown in — swap the flying overlay for the real grid.
  const [settled, setSettled] = useState(false);
  // Capture phase: 0 = wall settled/centred, 1 = wall scooted left + column in.
  const [scoot, setScoot] = useState(0);
  // Which capture step is active — driven purely by scroll position.
  const [activeStep, setActiveStep] = useState(0);
  // 0→1 scroll progress through the active step's band (feeds the indicator rail).
  const [stepProgress, setStepProgress] = useState(0);
  // Platform-correct modifier symbol (⌘ on Apple, Ctrl elsewhere). Resolved
  // after mount to avoid an SSR/client mismatch; defaults to the Mac form.
  const [modSym, setModSym] = useState("⌘");
  // Natural (unscaled) grid height + viewport height, so the wall can scale to
  // fit the space left below the sticky header once scooted.
  const [gridNatH, setGridNatH] = useState(0);
  const [vh, setVh] = useState(0);
  // Current phase of the auto-playing extension vignette.
  const [vignette, setVignette] = useState<VignettePhase>("idle");
  // Current phase of the auto-playing drag & drop vignette.
  const [drop, setDrop] = useState<DropPhase>("idle");
  // Current phase of the auto-playing paste vignette.
  const [paste, setPaste] = useState<PastePhase>("idle");

  const wrapperRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const liRefs = useRef<(HTMLLIElement | null)[]>([]);
  const flyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settledRef = useRef(false);
  const gridHRef = useRef(0);
  const vhRef = useRef(0);
  // Mirrors `savedCardVisible` for the scroll handler: while the saved card is
  // in the wall we freeze the measured grid height at its baseline, so the
  // window keeps its size and clips the extra card instead of growing.
  const savedCardVisibleRef = useRef(false);

  // Smooth-scroll to the middle of a step's scroll band (makes it active).
  const scrollToStep = (i: number) => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const sectionTop = wrap.getBoundingClientRect().top + window.scrollY;
    const targetCap = SCOOT_FRAC + (i + 0.5) * STEP_BAND;
    window.scrollTo({
      top: sectionTop + targetCap * window.innerHeight * CAPTURE_VH,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    setModSym(getModifierKeySymbol());
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEffectOn(wide.matches && !reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  // Scroll handler: drives the capture phase (scoot + active step) once the wall
  // has settled and pins, and unsettles when scrolled back above the fly-in.
  // Runs only on scroll/resize (rAF-throttled) so it's idle when still.
  useEffect(() => {
    if (!effectOn) {
      setSettled(false);
      settledRef.current = false;
      setScoot(0);
      setActiveStep(0);
      setStepProgress(0);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const vh = window.innerHeight;
      // Single source of truth for the whole choreography, from the section's
      // top: settled (fly-in done), scoot, and active step. Deriving all three
      // from one measurement keeps them from desyncing on fast scrolls.
      const secTop = wrap.getBoundingClientRect().top;
      const nowSettled =
        easeInOut(clamp01((vh - secTop) / (vh * 0.85))) >= 0.999;
      if (nowSettled !== settledRef.current) {
        settledRef.current = nowSettled;
        setSettled(nowSettled);
      }
      // Capture progress runs from where the stage pins (secTop = 0).
      const cap = clamp01(-secTop / (vh * CAPTURE_VH));
      setScoot(clamp01(cap / SCOOT_FRAC));
      const { index, progress } = stepFromCap(cap);
      setActiveStep(index);
      setStepProgress(progress);
      // Track the viewport + grid's natural height so the wall can scale to fit
      // (measured off the transform, so scale doesn't feed back into it).
      if (vh !== vhRef.current) {
        vhRef.current = vh;
        setVh(vh);
      }
      // Freeze the baseline once the saved card is in the wall, so re-measuring
      // mid-scroll doesn't grow the window to swallow the extra (clipped) card.
      if (!savedCardVisibleRef.current) {
        const gh = gridRef.current?.offsetHeight ?? 0;
        if (Math.abs(gh - gridHRef.current) > 1) {
          gridHRef.current = gh;
          setGridNatH(gh);
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [effectOn]);

  // Drift + fly-in animation. Runs only while unsettled (settled is owned by
  // the scroll handler); the cards scatter around the hero and fly into the
  // grid as it rises. Each frame re-reads the section's position, so cards can
  // never freeze out of sync with the current scroll.
  useEffect(() => {
    if (!effectOn || settled) return;
    let raf = 0;
    const tick = (now: number) => {
      const grid = gridRef.current;
      const wrap = wrapperRef.current;
      if (grid && wrap) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Progress off the section top (it reaches 0 at pin); the grid top never
        // does — it rests ~a heading below the viewport top once pinned.
        const secTop = wrap.getBoundingClientRect().top;
        const p = easeInOut(clamp01((vh - secTop) / (vh * 0.85)));
        for (let i = 0; i < GALLERY_CARDS.length; i++) {
          const node = flyRefs.current[i];
          const li = liRefs.current[i];
          const s = GALLERY_CARDS[i].scatter;
          if (!node || !li) continue;
          const t = li.getBoundingClientRect();
          const drift = (1 - p) * s.amp * Math.sin(now / s.period + s.phase);
          const x = lerp(s.x * vw, t.left, p);
          const y = lerp(s.y * vh, t.top, p) + drift;
          const scale = lerp(s.scale, 1, p);
          const rot = lerp(s.rot, 0, p);
          const blur = lerp(s.blur, 0, p);
          node.style.width = `${t.width}px`;
          node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rot}deg)`;
          node.style.opacity = `${lerp(s.opacity, 1, p)}`;
          node.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
          node.style.zIndex = `${s.z}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [effectOn, settled]);

  const flying = effectOn && !settled;
  // The browser chrome frames the wall once it's scooted and stays framed as you
  // carry on through the capture steps — the UI is carried forward.
  const showChrome = effectOn && scoot > 0.95;
  // The extension-specific overlays (essay page, popup, active essay tab) only
  // play while the "save from anywhere" step is the active one.
  const showExtensionChrome = showChrome && activeStep === EXTENSION_STEP;

  // Drive the vignette. Each stage's demo plays only while its own step is the
  // active one and resets to idle the moment you leave — so it never runs in the
  // background, and scrolling (back or forward) to a step always replays it from
  // the start rather than resuming mid-step.
  const vignetteEngaged =
    effectOn && scoot >= 0.95 && activeStep === EXTENSION_STEP;
  useEffect(() => {
    if (!vignetteEngaged) {
      setVignette("idle");
      return;
    }
    const delay = VIGNETTE_TIMELINE[vignette];
    const next = NEXT_PHASE[vignette];
    if (delay === undefined || next === undefined) return; // "landed" holds
    const t = setTimeout(() => setVignette(next), delay);
    return () => clearTimeout(t);
  }, [vignetteEngaged, vignette]);

  // Drive the drag & drop vignette the same way, but only engage once its step
  // is reached (and beyond), so its dropped image also carries forward.
  const dropEngaged = effectOn && scoot >= 0.95 && activeStep === DROP_STEP;
  useEffect(() => {
    if (!dropEngaged) {
      setDrop("idle");
      return;
    }
    const delay = DROP_TIMELINE[drop];
    const next = DROP_NEXT[drop];
    if (delay === undefined || next === undefined) return; // "landed" holds
    const t = setTimeout(() => setDrop(next), delay);
    return () => clearTimeout(t);
  }, [dropEngaged, drop]);

  // Drive the paste vignette the same way, engaging once its step is reached.
  const pasteEngaged = effectOn && scoot >= 0.95 && activeStep === PASTE_STEP;
  useEffect(() => {
    if (!pasteEngaged) {
      setPaste("idle");
      return;
    }
    const delay = PASTE_TIMELINE[paste];
    const next = PASTE_NEXT[paste];
    if (delay === undefined || next === undefined) return; // "landed" holds
    const t = setTimeout(() => setPaste(next), delay);
    return () => clearTimeout(t);
  }, [pasteEngaged, paste]);

  // The essay tab is active from the switch through to the save completing.
  const onEssayTab =
    vignette === "essay" ||
    vignette === "popup" ||
    vignette === "saving" ||
    vignette === "saved";
  // Only surface the essay tab while its overlay is actually playing; otherwise
  // (e.g. carried forward into a later step) the abode tab stays active.
  const activeTab = showExtensionChrome && onEssayTab ? 1 : 0;
  const popupOpen =
    vignette === "popup" || vignette === "saving" || vignette === "saved";
  const saveState: SaveState =
    vignette === "saving" ? "saving" : vignette === "saved" ? "saved" : "idle";
  // Card visibility is kept separate from the (per-step) replay phase so
  // captured cards carry forward: while you're at a card's step it follows that
  // step's playback (mounts collapsed, then grows in on land), and once you're
  // past the step (activeStep > STEP) it stays in the wall even though the
  // replay has reset. Scrolling back before a step grows it out again.
  const scooted = scoot >= 0.95;
  // Latch each capture's completion so a card only carries forward once its
  // vignette actually reached "landed" — scrolling past mid-play doesn't count.
  const savedDone = useLandedLatch(vignette === "landed", scooted);
  const dropDone = useLandedLatch(
    drop === "landed",
    scooted && activeStep >= DROP_STEP,
  );
  const pasteDone = useLandedLatch(
    paste === "landed",
    scooted && activeStep >= PASTE_STEP,
  );
  const savedCardVisible =
    scooted &&
    ((activeStep > EXTENSION_STEP && savedDone) ||
      vignette === "saved" ||
      vignette === "returning" ||
      vignette === "landed");
  const savedCardGrown =
    (activeStep > EXTENSION_STEP && savedDone) || vignette === "landed";

  // Drag & drop: the demo overlay plays only on its own step; the dropped image
  // mounts (collapsed) on release and grows in once it lands, like the saved
  // card — and stays in the wall thereafter.
  const atDropStep = activeStep === DROP_STEP;
  const showDropDemo =
    showChrome && atDropStep && (drop === "dragging" || drop === "dropped");
  const dropCardVisible =
    scooted &&
    ((activeStep > DROP_STEP && dropDone) ||
      drop === "dropped" ||
      drop === "landed");
  const dropCardGrown =
    (activeStep > DROP_STEP && dropDone) || drop === "landed";

  // Paste: the shortcut shows only on its own step; the pasted tweet mounts on
  // release and grows in once it lands, then stays in the wall.
  const atPasteStep = activeStep === PASTE_STEP;
  const showPasteKeys = showChrome && atPasteStep && paste === "keys";
  const pasteCardVisible =
    scooted &&
    ((activeStep > PASTE_STEP && pasteDone) ||
      paste === "pasted" ||
      paste === "landed");
  const pasteCardGrown =
    (activeStep > PASTE_STEP && pasteDone) || paste === "landed";

  // Keep each card mounted through its grow-out on the way back, so scrolling
  // back before a step reverses the entrance instead of popping the card away.
  const savedCardRendered = useExitDelay(savedCardVisible, 340);
  const dropCardRendered = useExitDelay(dropCardVisible, 340);
  const pasteCardRendered = useExitDelay(pasteCardVisible, 340);
  const anyCardPresent =
    savedCardRendered || dropCardRendered || pasteCardRendered;

  // Freeze the measured baseline while any demo card is in the wall (including
  // its exit), so the window keeps its height and clips the extras.
  savedCardVisibleRef.current = anyCardPresent;

  // The wall shrinks as the capture column fades in. Anchored to its left edge,
  // so shrinking pulls the right edge in and opens a gutter before the column.
  // Once scooted it also scales down to fit the browser chrome (tab strip +
  // grid) into the band below the sticky header, and nudges down to sit centred
  // in that band — so the tab strip clears the header instead of hiding under it.
  const HEADER_RESERVE = 72; // sticky header height + breathing room
  const CHROME_TAB_H = 64; // BrowserChrome tab strip (its -top-16)
  const BOTTOM_RESERVE = 24;
  const scootScale = 1 - scoot * 0.34;
  const bandH = Math.max(0, vh - HEADER_RESERVE - BOTTOM_RESERVE);
  // The scale that fits tab strip + grid into the band; 1 when we have room.
  const fitScale =
    gridNatH > 0 && vh > 0 ? clamp01(bandH / (gridNatH + CHROME_TAB_H)) : 1;
  // Only enforce the fit as we scoot (the settled/heading state keeps full size).
  const wallScale = Math.min(scootScale, lerp(1, fitScale, scoot));
  const wallShift =
    scoot *
    ((HEADER_RESERVE - BOTTOM_RESERVE) / 2 + (CHROME_TAB_H * wallScale) / 2);
  const wallStyle: CSSProperties | undefined = effectOn
    ? {
        transform: `translateY(${wallShift}px) scale(${wallScale})`,
        transformOrigin: "left center",
      }
    : undefined;

  return (
    <section ref={wrapperRef} className="relative w-full">
      {/* Flying overlay — mirrors each grid card while it drifts in from the
          edges of the hero. Fixed to the viewport, behind the hero. */}
      {flying && (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          {GALLERY_CARDS.map((card, i) => (
            <div
              key={card.id}
              ref={(el) => {
                flyRefs.current[i] = el;
              }}
              className={cn(
                faceClass(card),
                "absolute top-0 left-0 will-change-transform",
              )}
              style={{
                transformOrigin: "top left",
                opacity: 0,
                ...faceStyle(card),
              }}
            >
              <CardBody card={card} />
            </div>
          ))}
        </div>
      )}

      {/* Pinned stage — the wall settles here (vertically centred), then scoots
          left for capture. */}
      <div
        className={cn(
          effectOn
            ? "sticky top-0 flex h-screen items-center overflow-hidden"
            : "py-24",
        )}
      >
        {/* `isolate` scopes the wall/column z-ordering to this container, so the
            wall's z-10 can't escape to compete with the top-section content or
            the sticky header — it only ranks the wall above the capture column. */}
        <div className="relative isolate mx-auto w-full max-w-6xl px-4">
          {/* Intro heading — collapses + fades as the capture column takes
              over, so the wall alone centres. */}
          <div
            className="mx-auto max-w-xl overflow-hidden text-center"
            style={
              effectOn
                ? {
                    opacity: clamp01(1 - scoot * 1.7),
                    maxHeight: `${(1 - clamp01(scoot * 1.5)) * 8}rem`,
                    marginBottom: `${(1 - clamp01(scoot * 1.5)) * 3.5}rem`,
                  }
                : { marginBottom: "3.5rem" }
            }
          >
            <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
              this is <Highlight>your</Highlight> abode.
            </h2>
          </div>

          {/* The wall — raised above the capture column so the grid overlaps it
              where they meet during the scoot (the column paints behind). */}
          <div className="relative z-10" style={wallStyle}>
            <BrowserChrome
              show={showChrome}
              activeTab={activeTab}
              extensionActive={showExtensionChrome && popupOpen}
            >
              {effectOn && (
                <EssayPage show={showExtensionChrome && onEssayTab} />
              )}
              {effectOn && (
                <ExtensionPopup
                  show={showExtensionChrome && popupOpen}
                  state={saveState}
                />
              )}
              {effectOn && (
                <DragDropDemo
                  show={showDropDemo}
                  dropping={drop === "dropped"}
                />
              )}
              {effectOn && <PasteKeys show={showPasteKeys} modSym={modSym} />}
              {/* Fixed-height window: once a demo card lands, hold the wall's
                  height and clip the overflow rather than growing the window. */}
              <div
                style={
                  effectOn && anyCardPresent && gridNatH > 0
                    ? { height: gridNatH, overflow: "hidden" }
                    : undefined
                }
              >
                <ul
                  ref={gridRef}
                  className={cn(
                    "relative z-10 columns-2 gap-4 sm:columns-3 [&>li]:mb-4",
                    // Chrome gutter only when the effect is on; without it the
                    // static fallback grid keeps its original edge-to-edge layout.
                    // pb absorbs each column's trailing mb-4 so the bottom gutter
                    // matches the other three sides (8 + 16 = 24).
                    effectOn && "p-6 pb-2",
                    flying && "invisible",
                  )}
                >
                  {/* Freshly-captured items land at the top of the wall, newest
                      first, growing in as they arrive (paste, drop, save) and
                      growing out again when scrolled back before their step. */}
                  {effectOn && pasteCardRendered && (
                    <GrowInCard card={PASTE_CARD} grown={pasteCardGrown} />
                  )}
                  {effectOn && dropCardRendered && (
                    <GrowInCard card={DROP_CARD} grown={dropCardGrown} />
                  )}
                  {effectOn && savedCardRendered && (
                    <GrowInCard card={SAVED_CARD} grown={savedCardGrown} />
                  )}
                  {GALLERY_CARDS.map((card, i) => (
                    <li
                      key={card.id}
                      ref={(el) => {
                        liRefs.current[i] = el;
                      }}
                      className="group relative break-inside-avoid"
                    >
                      <div
                        className={cn(faceClass(card), hoverClass(card))}
                        style={faceStyle(card)}
                      >
                        <CardBody card={card} />
                        <Intelligence card={card} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </BrowserChrome>
          </div>

          {/* Capture column — fades/slides in from the right during the scoot.
              The wall (raised above it, see the wall wrapper's z-10) overlaps it
              where they meet; the column stays above its parent so the steps are
              still the top hit-target and remain clickable. */}
          {effectOn && (
            <div
              className="pointer-events-auto absolute top-1/2 right-0 w-80"
              style={{
                opacity: scoot,
                transform: `translate(${(1 - scoot) * 32}px, -50%)`,
              }}
            >
              <h3 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight">
                save <Highlight>it all.</Highlight>
              </h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                no folders, no filing — just paste, drop, or save.
              </p>
              <ol className="mt-8 flex flex-col gap-2">
                {STEPS.map((step, i) => {
                  const active = i === activeStep;
                  const StepIcon = step.icon;
                  return (
                    <li key={step.id} className="flex items-stretch gap-3">
                      <StepRail active={active} progress={stepProgress} />
                      <button
                        type="button"
                        onClick={() => scrollToStep(i)}
                        className={cn(
                          "min-w-0 flex-1 cursor-pointer rounded-xl border p-4 text-left transition-[opacity,background-color,border-color] duration-300",
                          active
                            ? "border-border bg-muted/50"
                            : "border-transparent opacity-50 hover:opacity-80",
                        )}
                      >
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <StepIcon className="size-4 shrink-0 text-muted-foreground" />
                          {step.label}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-muted-foreground text-sm leading-snug transition-[max-height,opacity] duration-300",
                            active
                              ? "max-h-24 opacity-100"
                              : "max-h-0 overflow-hidden opacity-0",
                          )}
                        >
                          {step.body.includes("{paste}") ? (
                            <>
                              <KbdGroup className="align-middle">
                                <Kbd>{modSym}</Kbd>
                                <Kbd>V</Kbd>
                              </KbdGroup>{" "}
                              {step.body.replace("{paste} ", "")}
                            </>
                          ) : (
                            step.body
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Scroll budget for the capture phase (only while pinned). */}
      {effectOn && <div style={{ height: `${CAPTURE_VH * 100}vh` }} />}
    </section>
  );
}
