import type { Preview } from "@storybook/nextjs-vite";
import { Geist, Geist_Mono, Hedvig_Letters_Serif } from "next/font/google";
import { useEffect } from "react";

import "../src/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hedvigSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-serif",
  subsets: ["latin"],
});

const fontVariables = `${geistSans.variable} ${geistMono.variable} ${hedvigSerif.variable}`;

// Mirrors the app's <body> so portalled content (dialogs, popovers) gets the
// font variables too, not just the story's own subtree
function BodyFonts() {
  useEffect(() => {
    const classes = fontVariables.split(" ");
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, []);
  return null;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  decorators: [
    (Story) => (
      <div className={`${fontVariables} antialiased`}>
        <BodyFonts />
        <Story />
      </div>
    ),
  ],
};

export default preview;
