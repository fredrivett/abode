import type { Preview } from "@storybook/nextjs-vite";
import { Geist, Geist_Mono, Hedvig_Letters_Serif } from "next/font/google";
import { useEffect } from "react";
import { sb } from "storybook/test";

import "../src/app/globals.css";

// Stories run against src/lib/supabase/__mocks__/client.ts: no env, no real project
sb.mock(import("../src/lib/supabase/client.ts"));

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

// Mirrors the app's <html>, where Tailwind sets the page font, so the stories
// render in Geist and portalled content (dialogs, popovers) gets it too
function RootFonts() {
  useEffect(() => {
    const classes = fontVariables.split(" ");
    document.documentElement.classList.add(...classes);
    return () => document.documentElement.classList.remove(...classes);
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
        <RootFonts />
        <Story />
      </div>
    ),
  ],
};

export default preview;
