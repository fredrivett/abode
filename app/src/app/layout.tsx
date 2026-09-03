import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Hedvig_Letters_Serif } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { Footer } from "@/components/footer";
import { GIT_BRANCH } from "@/env";
import { APP_NAME } from "@/lib/app";
import { shortBranchName } from "@/lib/branch-title";
import { QueryProvider } from "@/lib/query-client";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Prefix the tab title with the git branch during local dev so parallel branch
// checkouts are easy to tell apart. GIT_BRANCH is only injected in development,
// so production is unaffected. Using a template also prefixes pages that set
// their own title (e.g. "Help | abode").
const branchName = shortBranchName(GIT_BRANCH);
const branchPrefix = branchName ? `[${branchName}] ` : "";

export const metadata: Metadata = {
  title: {
    default: `${branchPrefix}${APP_NAME}`,
    template: `${branchPrefix}%s`,
  },
  description: "the home for your info",
  applicationName: APP_NAME,
  icons: {
    icon: [
      {
        url: "/favicon-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before first paint so every route
            (including auth pages that render no header/toggle) avoids a flash
            of the wrong mode. Lives in <head> so it runs before the body
            renders, and so it's not a `body > script` — PostHog's loader
            (instrumentation-client) inserts its own script before the first
            `body > script`, which would otherwise shift this node's DOM
            position and break hydration. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, constant-built theme bootstrap script */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${hedvigSerif.variable} flex min-h-screen flex-col antialiased`}
      >
        <QueryProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <Suspense>
            <CommandPalette />
          </Suspense>
          <Footer />
        </QueryProvider>
        <Toaster richColors theme="system" />
      </body>
    </html>
  );
}
