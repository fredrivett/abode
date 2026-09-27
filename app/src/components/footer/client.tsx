"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { comparePath } from "@/lib/comparisons/paths";
import { GITHUB_URL } from "@/lib/github";
import { X_URL } from "@/lib/social";
import { cn } from "@/lib/utils";
import { AbodeLogo } from "../abode-logo";

const TEXT = "your humble ";

type FooterClientProps = {
  isAuthenticated: boolean;
};

export function FooterClient({ isAuthenticated }: FooterClientProps) {
  const logoHref = isAuthenticated ? "/dashboard" : "/";
  const [isAnimating, setIsAnimating] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    setVisibleChars(0);
    setShowLogo(false);

    let charIndex = 0;
    const animate = () => {
      if (charIndex < TEXT.length) {
        charIndex++;
        setVisibleChars(charIndex);
        animationRef.current = setTimeout(animate, 40);
      } else {
        setShowLogo(true);
      }
    };
    animate();
  }, []);

  const resetAnimation = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    setIsAnimating(false);
    setVisibleChars(0);
    setShowLogo(false);
  }, []);

  // Pre-compute character array with stable keys
  const characters = TEXT.split("").map((char, index) => ({
    char,
    key: `char-${char}-${index}`,
  }));

  const signOff = (
    <div
      className={cn(
        "flex select-none items-center gap-1 whitespace-nowrap text-muted-foreground opacity-50 transition-opacity duration-300 hover:opacity-100",
        isAuthenticated && "justify-center",
      )}
    >
      <span className="relative font-serif text-lg leading-none">
        {/* Base text always visible */}
        <span className={isAnimating ? "invisible" : ""}>{TEXT}</span>
        {/* Animated overlay - only shown during animation */}
        {isAnimating && (
          <span className="absolute inset-0">
            {characters.map(({ char, key }, index) => (
              <span
                key={key}
                className={`transition-opacity duration-100 ${
                  index < visibleChars ? "opacity-100" : "opacity-0"
                }`}
              >
                {char}
              </span>
            ))}
          </span>
        )}
      </span>
      <Link href={logoHref}>
        <AbodeLogo
          className={`mb-[0.2em] h-4 w-auto transition-opacity duration-300 ${
            isAnimating && !showLogo ? "opacity-0" : "opacity-100"
          }`}
          aria-label="abode"
        />
      </Link>
    </div>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: decorative hover animation
    <footer
      className="mt-auto w-full px-4 py-6"
      onMouseEnter={startAnimation}
      onMouseLeave={resetAnimation}
    >
      {isAuthenticated ? (
        signOff
      ) : (
        // Logged-out visitors (and crawlers) get a few quiet links alongside
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {signOff}
          <nav
            aria-label="more"
            className="flex gap-5 text-muted-foreground text-sm"
          >
            <Link
              href={comparePath()}
              className="transition-colors hover:text-foreground"
            >
              /compare
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              github
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              x
            </a>
          </nav>
        </div>
      )}
    </footer>
  );
}
