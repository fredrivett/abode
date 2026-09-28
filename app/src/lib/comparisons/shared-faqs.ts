import type { Comparison, ComparisonFaq } from "./types";

/** Questions every comparison page answers, after its own specific ones */
export function sharedFaqs(comparison: Comparison): ComparisonFaq[] {
  return [
    {
      question: `can I bring my ${comparison.name} library to abode?`,
      answer: `not yet — a ${comparison.name} importer is next on the roadmap. for now, you save things one by one.`,
    },
    {
      question: "is abode free?",
      answer:
        "self-hosting is free, forever — the code is AGPL-3.0 on github. the hosted version is in invite-only early access: join the waitlist to get in.",
    },
    {
      question: "can I run abode myself?",
      answer:
        "yes. it needs Postgres and Supabase; everything else, like AI descriptions and image search, lights up when you add its key. the self-hosting docs are still evolving.",
    },
    {
      question: "is what I save private?",
      answer:
        "yes, unless you choose otherwise: things are private until you put them in a public room or share them, and public pages stay out of search engines unless you opt in.",
    },
  ];
}
