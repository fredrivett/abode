import type { Metadata } from "next";
import { AbodeInline } from "@/components/abode-inline";
import { GITHUB_URL } from "@/lib/github";
import { ROUTES } from "@/lib/routes";

const TITLE = "privacy policy — abode";
const DESCRIPTION =
  "what abode collects, why, who processes it, and how to export or delete your data. covers the website, the app and the browser extension.";
const CONTACT_EMAIL = "fred@abode.fyi";
const LAST_UPDATED = "17 November 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.PRIVACY },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: ROUTES.PRIVACY,
    siteName: "abode",
    type: "website",
  },
};

// Services that process data on abode's behalf, and what each one sees
const PROCESSORS = [
  { name: "Vercel", purpose: "hosts the website and API" },
  {
    name: "Supabase",
    purpose: "database, sign-in and file storage for your account and library",
  },
  {
    name: "Trigger.dev",
    purpose: "runs the background jobs that process what you save",
  },
  {
    name: "OpenAI",
    purpose:
      "reads saved content (text, images, document pages) to write titles, descriptions and tags, read text in images, and power search",
  },
  {
    name: "Replicate",
    purpose: "creates image embeddings for finding similar images",
  },
  {
    name: "Google Cloud Vision",
    purpose: "reads text in scanned documents and picks out image colours",
  },
  {
    name: "TypeSafe",
    purpose: "helps decide whether a saved page is an article",
  },
  {
    name: "Mapbox",
    purpose: "turns photo locations into place names and map thumbnails",
  },
  {
    name: "Resend",
    purpose: "sends account emails (invites, confirmations, notices)",
  },
  {
    name: "PostHog",
    purpose: "product analytics, error reports and masked session replays",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <main className="w-full max-w-3xl px-4 pt-16 pb-16 sm:pt-24">
        <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          privacy policy
        </h1>
        <p className="mt-4 text-muted-foreground text-sm">
          last updated {LAST_UPDATED}
        </p>

        <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed [&_a]:underline [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
          <section>
            <p>
              <AbodeInline /> is a place to keep the things you find. This
              policy covers the hosted <AbodeInline /> at abode.fyi, its
              installable app and its browser extension, run by Jotmake Limited
              (&quot;we&quot;), a company registered in England and Wales.
              We&apos;re the controller of the personal data described here. If
              you use a self-hosted <AbodeInline />, whoever runs that instance
              decides how your data is handled, not us.
            </p>
            <p className="mt-4">
              The short version: what you save is yours. We use it to run{" "}
              <AbodeInline /> for you, we don&apos;t sell it, we don&apos;t show
              you ads, and you can export or delete it whenever you like.
            </p>
          </section>

          <section>
            <h2>what we collect</h2>
            <ul>
              <li>
                <strong>Your account:</strong> email address, username, name and
                profile details you add, your password (stored hashed by our
                sign-in provider) and, if you turn it on, your two-factor
                authentication setup.
              </li>
              <li>
                <strong>What you save:</strong> links and the pages behind them,
                images, PDFs, scans, notes, highlights, book reviews and rooms,
                plus what we derive from them (titles, descriptions, tags,
                extracted text, colours and search embeddings).
              </li>
              <li>
                <strong>Location:</strong> if a photo you save has location
                data, or you add a place yourself, we store it to show a map and
                let you search by place. Anyone viewing something you share sees
                only the city, region and country.
              </li>
              <li>
                <strong>Usage:</strong> analytics events, error reports and
                session replays linked to your account. They record how{" "}
                <AbodeInline /> is used, not what you save: replays mask all
                on-screen text, inputs, images and links in your browser before
                anything is sent, and search queries and room names are removed
                from recorded URLs.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser and device
                details in server logs and analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2>the browser extension</h2>
            <p>
              The extension only acts when you use it: clicking its button,
              pressing its shortcut, or choosing &quot;save&quot; from the
              right-click menu. It then sends the page address, link, image or
              selected text you chose to your <AbodeInline />; for a page save
              it also sends the page&apos;s content as it appears in your
              browser, so pages behind your logins save properly. It
              doesn&apos;t read pages in the background, track your browsing, or
              collect analytics. It stores your sign-in session in your browser
              so you stay signed in. The data it sends is handled exactly like
              anything else you save, as described here.
            </p>
          </section>

          <section>
            <h2>why we use it</h2>
            <ul>
              <li>
                To provide <AbodeInline />: storing, organising, searching and
                sharing your library, and processing what you save (this is the
                contract between us).
              </li>
              <li>
                To keep it secure and working, and to understand how it&apos;s
                used so we can improve it (our legitimate interests).
              </li>
              <li>
                To email you about your account: invites, confirmations and
                important changes. We don&apos;t send marketing email.
              </li>
            </ul>
            <p className="mt-4">
              We don&apos;t sell your data, share it with advertisers, or use it
              to train AI models.
            </p>
          </section>

          <section>
            <h2>who else processes it</h2>
            <p>
              We use these services to run <AbodeInline />. Each processes data
              only to provide its service to us:
            </p>
            <ul className="mt-3">
              {PROCESSORS.map((processor) => (
                <li key={processor.name}>
                  <strong>{processor.name}:</strong> {processor.purpose}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Some of them process data outside the UK, including in the United
              States. Where they do, the transfer is covered by the safeguards
              UK data protection law requires, such as standard contractual
              clauses.
            </p>
          </section>

          <section>
            <h2>what&apos;s public</h2>
            <p>
              Your items and rooms are private by default: others see an item or
              room only when you share or publish it. Your profile page is
              public and shows your name, username, bio, photo, your public
              rooms and, unless you turn it off, who invited you and who you
              invited. Public pages stay out of search engines unless you opt in
              from your settings.
            </p>
          </section>

          <section>
            <h2>cookies</h2>
            <p>
              We use cookies and browser storage to keep you signed in and, for
              analytics, to recognise your browser between visits. We don&apos;t
              use advertising cookies.
            </p>
          </section>

          <section>
            <h2>keeping and deleting it</h2>
            <p>
              We keep your data while you have an account. You can export
              everything at any time from your settings (JSON, Markdown,
              bookmarks, or every file). When you delete your account, we delete
              your items, rooms, stored files and sign-in account straight away.
              Analytics events and error reports linked to your account
              aren&apos;t deleted with it; email us and we&apos;ll remove them.
            </p>
          </section>

          <section>
            <h2>your rights</h2>
            <p>
              You can ask to access, correct, delete or receive a copy of your
              data, and object to or restrict how we use it. Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and
              we&apos;ll reply within a month. If you&apos;re unhappy with how
              we&apos;ve handled your data, you can complain to the UK
              Information Commissioner&apos;s Office at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
                ico.org.uk
              </a>
              .
            </p>
          </section>

          <section>
            <h2>children</h2>
            <p>
              <AbodeInline /> isn&apos;t meant for anyone under 13, and we
              don&apos;t knowingly collect their data.
            </p>
          </section>

          <section>
            <h2>changes</h2>
            <p>
              If we change this policy, we&apos;ll update the date at the top,
              and email you about anything significant. The code behind{" "}
              <AbodeInline /> is{" "}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                open source
              </a>
              , so you can check how it handles your data yourself.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
