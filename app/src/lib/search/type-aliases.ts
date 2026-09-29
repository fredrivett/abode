import type { ItemKind } from "@prisma/client";

/**
 * Words people type for an item kind, beyond the raw kind name itself — so
 * "tweets" offers `type:twitter` and "photos" offers `type:image`. Keyed by
 * ItemKind so a new kind fails `tsc` until it's given its words.
 *
 * Only words that essentially *name* the kind: suggestions are offered, never
 * auto-applied, but a loose alias ("shop", "read") would crowd out the tag and
 * status suggestions that same word should get. Plurals are generated (see
 * `withPlural`), so list singulars only.
 */
const KIND_ALIASES: Record<ItemKind, readonly string[]> = {
  image: ["image", "photo", "picture", "pic", "screenshot"],
  article: ["article", "blog", "blog post"],
  twitter: ["twitter", "tweet", "post"],
  instagram: ["instagram", "insta", "ig", "reel", "instagram post", "post"],
  video: ["video", "vid", "youtube", "yt"],
  product: ["product"],
  note: ["note"],
  webpage: ["webpage", "web page", "website"],
  book: ["book"],
  document: ["document", "doc", "pdf"],
};

function isItemKind(value: string): value is ItemKind {
  return value in KIND_ALIASES;
}

// Short abbreviations ("ig", "yt") don't pluralise naturally
function withPlural(term: string): string[] {
  return term.length > 2 && !term.endsWith("s") ? [term, `${term}s`] : [term];
}

/**
 * Every search term that should offer `type:<kind>`, keyed by the lowercased
 * term. A term can map to several kinds ("post" is both a tweet and an
 * Instagram post), in which case each is offered as an alternative.
 */
export const TYPE_TERMS: ReadonlyMap<string, readonly ItemKind[]> = (() => {
  const terms = new Map<string, ItemKind[]>();
  for (const kind of Object.keys(KIND_ALIASES).filter(isItemKind)) {
    for (const term of [kind, ...KIND_ALIASES[kind]].flatMap(withPlural)) {
      const kinds = terms.get(term) ?? [];
      if (!kinds.includes(kind)) kinds.push(kind);
      terms.set(term, kinds);
    }
  }
  return terms;
})();
