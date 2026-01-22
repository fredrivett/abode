"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: decorative hover animation
    <footer
      className="mt-auto w-full px-4 py-6"
      onMouseEnter={startAnimation}
      onMouseLeave={resetAnimation}
    >
      <div className="flex select-none items-center justify-center gap-1 whitespace-nowrap text-muted-foreground opacity-50 transition-opacity duration-300 hover:opacity-100">
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
    </footer>
  );
}
