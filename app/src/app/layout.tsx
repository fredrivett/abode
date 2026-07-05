import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Hedvig_Letters_Serif } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { Footer } from "@/components/footer";
import { GIT_BRANCH } from "@/env";
import { shortBranchName } from "@/lib/branch-title";
import { QueryProvider } from "@/lib/query-client";

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
    default: `${branchPrefix}abode`,
    template: `${branchPrefix}%s`,
  },
  description: "the home for your info",
  applicationName: "abode",
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
    title: "abode",
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
    <html lang="en">
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
