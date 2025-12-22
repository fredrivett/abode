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
      className="w-full py-6 px-4 mt-auto"
      onMouseEnter={startAnimation}
      onMouseLeave={resetAnimation}
    >
      <div className="flex items-center justify-center gap-1 text-muted-foreground select-none opacity-50 transition-opacity duration-300 hover:opacity-100 whitespace-nowrap">
        <span className="font-serif text-lg leading-none relative">
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
            className={`h-4 w-auto mb-[0.2em] transition-opacity duration-300 ${
              isAnimating && !showLogo ? "opacity-0" : "opacity-100"
            }`}
            aria-label="abode"
          />
        </Link>
      </div>
    </footer>
  );
}
