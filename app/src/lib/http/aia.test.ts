import { X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AIA_CROSSSIGN_ROOTYR_PEM,
  AIA_INTERMEDIATE_YR1_PEM,
  AIA_LEAF_PEM,
  AIA_ROOT_X1_PEM,
} from "./__fixtures__/aia-certs";
import { type AiaResolver, chaseAiaChain, isCertChainError } from "./aia";

// Real certificates captured from a server (writings.stephenwolfram.com) that
// ships only its leaf, forcing AIA completion. The chain is:
//   leaf → YR1 → Root YR → ISRG Root X1 (self-signed, a bundled trust anchor).
const leaf = new X509Certificate(AIA_LEAF_PEM);
const yr1 = new X509Certificate(AIA_INTERMEDIATE_YR1_PEM);
const rootYr = new X509Certificate(AIA_CROSSSIGN_ROOTYR_PEM);
const x1 = new X509Certificate(AIA_ROOT_X1_PEM); // self-signed root

const HTTPS_URL = new URL("https://writings.stephenwolfram.com/some/post/");
const neverAborts = new AbortController().signal;

/** A resolver serving our fixtures: leaf from the socket, issuers keyed by AIA URL. */
function resolver(overrides: Partial<AiaResolver> = {}): AiaResolver {
  const byUri: Record<string, Buffer> = {
    "http://yr1.i.lencr.org/": Buffer.from(yr1.raw),
    "http://yr.i.lencr.org/": Buffer.from(rootYr.raw),
    "http://x1.i.lencr.org/": Buffer.from(x1.raw),
  };
  return {
    getLeafCertificate: async () => Buffer.from(leaf.raw),
    fetchCertificate: async (uri) => byUri[uri] ?? null,
    // Only the real self-signed root is a trusted anchor.
    trustedRootSubjects: () => new Set([x1.subject]),
    ...overrides,
  };
}

/** Subjects of the certs a walk collected, for order-sensitive assertions. */
function subjects(pems: string[]): string[] {
  return pems.map((pem) => new X509Certificate(pem).subject);
}

describe("chaseAiaChain", () => {
  it("collects the missing intermediates up to the trusted anchor", async () => {
    const result = await chaseAiaChain(HTTPS_URL, neverAborts, resolver());
    // Adds YR1 and Root YR, then stops because Root YR's issuer (ISRG Root X1)
    // is already trusted — it never fetches or adds the root itself.
    expect(subjects(result)).toEqual([yr1.subject, rootYr.subject]);
  });

  it("skips http (there is no TLS chain to complete)", async () => {
    const httpUrl = new URL("http://writings.stephenwolfram.com/post/");
    expect(await chaseAiaChain(httpUrl, neverAborts, resolver())).toEqual([]);
  });

  it("returns nothing when the leaf certificate can't be read", async () => {
    const deps = resolver({ getLeafCertificate: async () => null });
    expect(await chaseAiaChain(HTTPS_URL, neverAborts, deps)).toEqual([]);
  });

  it("returns nothing when an issuer fetch fails", async () => {
    const deps = resolver({ fetchCertificate: async () => null });
    expect(await chaseAiaChain(HTTPS_URL, neverAborts, deps)).toEqual([]);
  });

  it("stops before fetching when the leaf's issuer is already trusted", async () => {
    let fetched = 0;
    const deps = resolver({
      trustedRootSubjects: () => new Set([leaf.issuer]),
      fetchCertificate: async (uri) => {
        fetched++;
        return resolver().fetchCertificate(uri, neverAborts);
      },
    });
    expect(await chaseAiaChain(HTTPS_URL, neverAborts, deps)).toEqual([]);
    expect(fetched).toBe(0);
  });

  it("never adds a self-signed root even if AIA points straight at one", async () => {
    // Nothing is trusted, so the walk would keep going — but the first issuer it
    // fetches is the self-signed root, which must not be trusted on our say-so.
    const deps = resolver({
      trustedRootSubjects: () => new Set<string>(),
      fetchCertificate: async () => Buffer.from(x1.raw),
    });
    expect(await chaseAiaChain(HTTPS_URL, neverAborts, deps)).toEqual([]);
  });

  it("caps the walk so a looping AIA graph can't fan out unbounded", async () => {
    // A non-self-signed cert that perpetually points onward, with nothing
    // trusted, so only MAX_AIA_HOPS bounds it.
    const deps = resolver({
      trustedRootSubjects: () => new Set<string>(),
      fetchCertificate: async () => Buffer.from(yr1.raw),
    });
    const result = await chaseAiaChain(HTTPS_URL, neverAborts, deps);
    expect(result.length).toBe(4); // MAX_AIA_HOPS
  });

  it("is best-effort: a throwing resolver yields no certs, not an error", async () => {
    const deps = resolver({
      getLeafCertificate: async () => {
        throw new Error("socket exploded");
      },
    });
    await expect(chaseAiaChain(HTTPS_URL, neverAborts, deps)).resolves.toEqual(
      [],
    );
  });
});

describe("isCertChainError", () => {
  it("matches Node's incomplete-chain codes", () => {
    for (const code of [
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ]) {
      expect(isCertChainError(Object.assign(new Error("x"), { code }))).toBe(
        true,
      );
    }
  });

  it("finds the code nested on a cause (undici wraps it in TypeError)", () => {
    const cause = Object.assign(new Error("verify"), {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });
    const wrapped = new TypeError("fetch failed", { cause });
    expect(isCertChainError(wrapped)).toBe(true);
  });

  it("ignores unrelated failures (timeouts, refused, plain errors)", () => {
    expect(
      isCertChainError(Object.assign(new Error("t"), { code: "ETIMEDOUT" })),
    ).toBe(false);
    expect(isCertChainError(new Error("nope"))).toBe(false);
    expect(isCertChainError("not even an error")).toBe(false);
  });
});
