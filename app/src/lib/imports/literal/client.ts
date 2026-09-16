import { safeFetch } from "@/lib/http/safe-fetch";

const LITERAL_GRAPHQL_URL = "https://literal.club/graphql/";
const REQUEST_TIMEOUT_MS = 20_000;
/** Cap pairs per `reviews` query so a large library stays within a sane request. */
const REVIEWS_CHUNK_SIZE = 100;

/** A Literal API failure (HTTP, GraphQL errors, or a malformed response). */
export class LiteralApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiteralApiError";
  }
}

export type LiteralReadingStatus =
  | "WANTS_TO_READ"
  | "IS_READING"
  | "FINISHED"
  | "DROPPED"
  | "NONE";

export type LiteralBook = {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover: string | null;
  language: string | null;
  authors: { name: string }[] | null;
  isbn13: string | null;
  isbn10: string | null;
  pageCount: number | null;
  publishedDate: string | null;
  publisher: string | null;
};

export type LiteralReadingState = {
  id: string;
  status: LiteralReadingStatus;
  createdAt: string;
  book: LiteralBook | null;
};

export type LiteralReview = {
  rating: number | null;
  text: string | null;
  createdAt: string | null;
};

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

/**
 * POST a GraphQL operation to Literal via {@link safeFetch} (SSRF-gated, though
 * the host is fixed). `token` is optional so the unauthenticated `login`
 * mutation can reuse this. Throws {@link LiteralApiError} on HTTP failure,
 * GraphQL `errors`, or a missing `data`.
 */
async function literalGraphql<T>(
  query: string,
  {
    token,
    variables,
  }: { token?: string; variables?: Record<string, unknown> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await safeFetch(LITERAL_GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new LiteralApiError(`Literal API returned HTTP ${response.status}`);
  }

  let json: GraphqlResponse<T>;
  try {
    json = (await response.json()) as GraphqlResponse<T>;
  } catch {
    throw new LiteralApiError("Literal API returned a non-JSON response");
  }
  if (typeof json !== "object" || json === null) {
    throw new LiteralApiError("Literal API returned an unexpected response");
  }
  if (json.errors?.length) {
    throw new LiteralApiError(
      json.errors.map((e) => e.message).join("; ") || "Literal API error",
    );
  }
  if (json.data === undefined || json.data === null) {
    throw new LiteralApiError("Literal API returned no data");
  }
  return json.data;
}

/**
 * Extract the `profileId` embedded in a Literal access-token JWT, without a
 * network call. Returns null if the token isn't a decodable JWT with a
 * `profileId` claim.
 */
export function profileIdFromToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { profileId?: unknown };
    return typeof payload.profileId === "string" ? payload.profileId : null;
  } catch {
    return null;
  }
}

const LOGIN_MUTATION = `mutation login($email: String!, $password: String!) {
  login(email: $email, password: $password) { token profile { id } }
}`;

/** Exchange email + password for an access token + profileId (~6-month token). */
export async function loginToLiteral({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ token: string; profileId: string }> {
  const data = await literalGraphql<{
    login: { token: string; profile: { id: string } } | null;
  }>(LOGIN_MUTATION, { variables: { email, password } });
  if (!data.login?.token || !data.login.profile?.id) {
    throw new LiteralApiError("Literal login did not return a token");
  }
  return { token: data.login.token, profileId: data.login.profile.id };
}

const READING_STATES_QUERY = `query {
  myReadingStates {
    id
    status
    createdAt
    book {
      id slug title subtitle description cover language
      authors { name }
      isbn13 isbn10 pageCount publishedDate publisher
    }
  }
}`;

/** Fetch every reading state for the authenticated profile (all shelves). */
export async function fetchReadingStates(
  token: string,
): Promise<LiteralReadingState[]> {
  const data = await literalGraphql<{ myReadingStates: LiteralReadingState[] }>(
    READING_STATES_QUERY,
    { token },
  );
  return data.myReadingStates ?? [];
}

const REVIEWS_QUERY = `query reviews($pairs: [ProfileIdBookIdInput!]!) {
  reviews(pairs: $pairs) { rating text createdAt }
}`;

/**
 * Fetch reviews for `(profileId, bookId)` pairs. Literal returns them in the
 * same order as the input pairs (null where a book has no review), so callers
 * zip the result back by index. Chunked to keep each request bounded.
 */
export async function fetchReviews(
  token: string,
  pairs: { profileId: string; bookId: string }[],
): Promise<(LiteralReview | null)[]> {
  const out: (LiteralReview | null)[] = [];
  for (let i = 0; i < pairs.length; i += REVIEWS_CHUNK_SIZE) {
    const chunk = pairs.slice(i, i + REVIEWS_CHUNK_SIZE);
    const data = await literalGraphql<{ reviews: (LiteralReview | null)[] }>(
      REVIEWS_QUERY,
      { token, variables: { pairs: chunk } },
    );
    out.push(...(data.reviews ?? []));
  }
  return out;
}
