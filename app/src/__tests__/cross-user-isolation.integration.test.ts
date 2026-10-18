/// <reference types="vitest/globals" />

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { resetTestDatabase } from "@app/vitest.setup.db";
import { NextRequest } from "next/server";

/**
 * Cross-user isolation: every API route, called by another signed-in user and
 * anonymously, must neither return the victim's private content nor change
 * the victim's data. Tenant isolation lives in application code (the app's DB
 * role bypasses RLS), so one missed `userId` filter anywhere would expose
 * every user — this sweep is the backstop.
 *
 * - The victim's private content carries CANARY; any response containing it
 *   is a leak. Content that's legitimately public (a shared item's title)
 *   doesn't, but private fields on public items (notes) do.
 * - After every call, a snapshot of everything the victim owns (plus every
 *   storage write/delete under their folder) must be unchanged.
 * - A new route or method fails "covers every route" until it has a case here
 *   or an EXEMPT entry with a reason.
 */

const CANARY = "XVICTIMSECRETX";

const h = vi.hoisted(() => {
  // Same behaviour locally (where .env holds real keys) and in CI: no optional
  // third-party service is configured, so nothing leaves the process, except
  // Trigger.dev, whose SDK is mocked, so export/import paths still run
  for (const key of [
    "OPENAI_API_KEY",
    "REPLICATE_API_TOKEN",
    "GOOGLE_CLOUD_CREDENTIALS",
    "JEV_API_KEY",
    "MAPBOX_ACCESS_TOKEN",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ]) {
    delete process.env[key];
  }
  process.env.TRIGGER_SECRET_KEY = "tr_test_isolation";

  const state = {
    viewer: null as { id: string; email: string } | null,
    storageOps: [] as string[],
    emails: [] as string[],
    errors: [] as unknown[],
  };

  const storage = {
    from: (bucket: string) => ({
      download: async (key: string) => ({
        data: new Blob([`FILE ${bucket}/${key}`], { type: "image/jpeg" }),
        error: null,
      }),
      upload: async (key: string) => {
        state.storageOps.push(`upload ${bucket}/${key}`);
        return { data: { path: key }, error: null };
      },
      remove: async (keys: string[]) => {
        for (const key of keys)
          state.storageOps.push(`remove ${bucket}/${key}`);
        return { data: keys.map((name) => ({ name })), error: null };
      },
      createSignedUrl: async (key: string) => ({
        data: { signedUrl: `https://storage.test/signed/${bucket}/${key}` },
        error: null,
      }),
      createSignedUrls: async (keys: string[]) => ({
        data: keys.map((path) => ({
          path,
          signedUrl: `https://storage.test/signed/${bucket}/${path}`,
          error: null,
        })),
        error: null,
      }),
      list: async () => ({ data: [], error: null }),
      getPublicUrl: (key: string) => ({
        data: { publicUrl: `https://storage.test/public/${bucket}/${key}` },
      }),
    }),
  };

  // The cookie client: whoever `state.viewer` is, with no MFA enrolled
  const userClient = () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: state.viewer
            ? {
                id: state.viewer.id,
                email: state.viewer.email,
                user_metadata: {},
                app_metadata: {},
              }
            : null,
        },
        error: null,
      }),
      getClaims: async () => ({ data: { claims: {} }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { totp: [], all: [] }, error: null }),
      },
    },
    storage,
  });

  const adminClient = () => ({
    storage,
    auth: {
      // The sensitive-unlock password check: every guess is wrong
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: { status: 400, message: "Invalid login credentials" },
      }),
      signOut: async () => ({ error: null }),
      admin: {
        getUserById: async () => ({ data: { user: null }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
  });

  return { state, userClient, adminClient };
});

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createClient: async () => h.userClient(),
}));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: () => h.adminClient(),
}));
vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(async () => ({ id: "run_test" })),
    batchTrigger: vi.fn(async () => ({ batchId: "batch_test", runs: [] })),
  },
  runs: { retrieve: vi.fn(async () => null), cancel: vi.fn(async () => null) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/logger.server", () => {
  const noop = () => {};
  const logger = {
    info: noop,
    debug: noop,
    trace: noop,
    warn: noop,
    error: (...args: unknown[]) => h.state.errors.push(args),
    fatal: (...args: unknown[]) => h.state.errors.push(args),
  };
  return { createLogger: () => logger };
});
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => null,
  captureServerException: (error: unknown) => h.state.errors.push(error),
  shutdownPostHog: async () => {},
}));
// Emails are captured, and checked for leaks like responses
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: async (options: { to: string; subject: string; text: string }) => {
    h.state.emails.push(`${options.to} ${options.subject} ${options.text}`);
    return { success: true, id: "test-email" };
  },
}));
// No network: anything that would fetch a URL fails like an unreachable host
vi.mock("@/lib/http/safe-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/safe-fetch")>();
  return {
    ...actual,
    safeFetch: async () => {
      throw new actual.SafeFetchError(
        "unresolvable_host",
        "fetch disabled in tests",
      );
    },
  };
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

type Ids = Awaited<ReturnType<typeof seed>>;

type Case = {
  /** Route directory under src/app/api, e.g. "v1/items/[id]" */
  route: string;
  method: Method;
  /** What the call attempts, for failure messages */
  name: string;
  params?: (ids: Ids) => Record<string, string>;
  query?: (ids: Ids) => Record<string, string>;
  body?: (ids: Ids) => unknown;
  form?: () => FormData;
};

const API_DIR = join(__dirname, "../app/api");

/** Route methods deliberately not swept here, with why */
const EXEMPT: Record<string, string> = {
  "mcp GET": "JSON-RPC transport; its tools are swept directly below",
  "mcp POST": "JSON-RPC transport; its tools are swept directly below",
  "mcp DELETE": "JSON-RPC transport; its tools are swept directly below",
};

const victimItem = (ids: Ids) => ({ id: ids.victim.privateItemId });

const CASES: Case[] = [
  // CORS preflights
  {
    route: "v1/embed/rooms/[roomId]",
    method: "OPTIONS",
    name: "preflight the victim's room embed",
    params: (ids) => ({ roomId: ids.victim.privateRoomId }),
  },
  { route: "v1/items/from-url", method: "OPTIONS", name: "preflight a save" },
  { route: "v1/items/notes", method: "OPTIONS", name: "preflight a note" },
  {
    route: "v1/items/[id]/instagram-enrich",
    method: "OPTIONS",
    name: "preflight enriching the victim's item",
    params: victimItem,
  },

  // Admin — a non-admin gets nothing
  { route: "v1/admin/stats", method: "GET", name: "read global stats" },
  { route: "v1/admin/users", method: "GET", name: "list users" },
  {
    route: "v1/admin/users/[id]",
    method: "GET",
    name: "read the victim's account",
    params: (ids) => ({ id: ids.victim.userId }),
  },
  {
    route: "v1/admin/waitlist/invite",
    method: "POST",
    name: "invite from the waitlist",
    body: () => ({ email: "someone@example.com" }),
  },
  {
    route: "v1/ai/suggest-emoji",
    method: "POST",
    name: "suggest an emoji",
    body: () => ({ name: "Recipes" }),
  },

  // Embeds — public rooms only, without excluded items or private fields
  {
    route: "v1/embed/rooms/[roomId]",
    method: "GET",
    name: "embed the victim's private room",
    params: (ids) => ({ roomId: ids.victim.privateRoomId }),
  },
  {
    route: "v1/embed/rooms/[roomId]",
    method: "GET",
    name: "embed the victim's public room",
    params: (ids) => ({ roomId: ids.victim.publicRoomId }),
  },

  // Exports / imports
  {
    route: "v1/exports/[id]/download",
    method: "GET",
    name: "download the victim's export",
    params: (ids) => ({ id: ids.victim.exportId }),
  },
  { route: "v1/exports", method: "GET", name: "list exports" },
  { route: "v1/exports", method: "POST", name: "start an export" },
  {
    route: "v1/imports/[id]",
    method: "GET",
    name: "read the victim's import",
    params: (ids) => ({ id: ids.victim.importId }),
  },
  {
    route: "v1/imports/literal",
    method: "POST",
    name: "start an import",
    body: () => ({ csv: "" }),
  },

  { route: "v1/filters", method: "GET", name: "list filters" },
  {
    route: "v1/filters",
    method: "GET",
    name: "list tag filters",
    query: () => ({ type: "tags" }),
  },

  // Image proxy — the victim's private file, and their shared one
  {
    route: "v1/images/[fileKey]",
    method: "GET",
    name: "fetch the victim's private image",
    params: (ids) => ({
      fileKey: encodeURIComponent(ids.victim.privateFileKey),
    }),
  },
  {
    route: "v1/images/[fileKey]",
    method: "GET",
    name: "fetch the victim's excluded-from-public image",
    params: (ids) => ({
      fileKey: encodeURIComponent(ids.victim.excludedFileKey),
    }),
  },

  // Invites
  {
    route: "v1/invites/[id]",
    method: "DELETE",
    name: "revoke the victim's invite",
    params: (ids) => ({ id: ids.victim.inviteId }),
  },
  { route: "v1/invites", method: "GET", name: "list invites" },
  {
    route: "v1/invites",
    method: "POST",
    name: "send an invite",
    body: () => ({ email: "friend@example.com" }),
  },
  {
    route: "v1/invites/validate",
    method: "GET",
    name: "validate an unknown invite token",
    query: () => ({ token: "not-a-real-token" }),
  },

  // Items, by the victim's ids
  {
    route: "v1/items/[id]",
    method: "GET",
    name: "read the victim's private item",
    params: victimItem,
  },
  {
    route: "v1/items/[id]",
    method: "GET",
    name: "read the victim's shared item",
    params: (ids) => ({ id: ids.victim.sharedItemId }),
  },
  {
    route: "v1/items/[id]",
    method: "PATCH",
    name: "edit the victim's item",
    params: victimItem,
    body: () => ({ title: "pwned", notes: "pwned", shared: true }),
  },
  {
    route: "v1/items/[id]",
    method: "DELETE",
    name: "delete the victim's item",
    params: victimItem,
  },
  {
    route: "v1/items/[id]/highlights",
    method: "GET",
    name: "read the victim's highlights",
    params: (ids) => ({ id: ids.victim.articleItemId }),
  },
  {
    route: "v1/items/[id]/highlights",
    method: "POST",
    name: "highlight the victim's article",
    params: (ids) => ({ id: ids.victim.articleItemId }),
    body: () => ({ startOffset: 0, endOffset: 4, text: "pwnd" }),
  },
  {
    route: "v1/items/[id]/highlights/[highlightId]",
    method: "PATCH",
    name: "edit the victim's highlight",
    params: (ids) => ({
      id: ids.victim.articleItemId,
      highlightId: ids.victim.highlightId,
    }),
    body: () => ({ note: "pwned" }),
  },
  {
    route: "v1/items/[id]/highlights/[highlightId]",
    method: "DELETE",
    name: "delete the victim's highlight",
    params: (ids) => ({
      id: ids.victim.articleItemId,
      highlightId: ids.victim.highlightId,
    }),
  },
  {
    route: "v1/items/[id]/highlights/[highlightId]",
    method: "PATCH",
    name: "edit the victim's highlight via the attacker's own item",
    params: (ids) => ({
      id: ids.attacker.itemId,
      highlightId: ids.victim.highlightId,
    }),
    body: () => ({ note: "pwned" }),
  },
  {
    route: "v1/items/[id]/instagram-enrich",
    method: "POST",
    name: "enrich the victim's item",
    params: victimItem,
    body: () => ({ media: [] }),
  },
  {
    route: "v1/items/[id]/links",
    method: "POST",
    name: "add a link to the victim's item",
    params: victimItem,
    body: () => ({ url: "https://example.com/pwned" }),
  },
  {
    route: "v1/items/[id]/links",
    method: "DELETE",
    name: "remove a link from the victim's item",
    params: victimItem,
    body: () => ({ url: "https://example.com/victim-link" }),
  },
  {
    route: "v1/items/[id]/location",
    method: "POST",
    name: "set the victim's item location",
    params: victimItem,
    body: () => ({ latitude: 1, longitude: 1 }),
  },
  {
    route: "v1/items/[id]/location",
    method: "DELETE",
    name: "clear the victim's item location",
    params: victimItem,
  },
  {
    route: "v1/items/[id]/pages",
    method: "GET",
    name: "read the victim's document pages",
    params: victimItem,
  },
  {
    route: "v1/items/[id]/reassign",
    method: "POST",
    name: "reassign the victim's item",
    params: victimItem,
    body: () => ({ kind: "article" }),
  },
  {
    route: "v1/items/[id]/retry",
    method: "POST",
    name: "retry the victim's item",
    params: victimItem,
  },
  {
    route: "v1/items/[id]/similar",
    method: "GET",
    name: "find items similar to the victim's",
    params: victimItem,
  },

  // Item creation can't adopt the victim's files
  {
    route: "v1/items",
    method: "POST",
    name: "create an item from the victim's file",
    body: (ids) => ({
      kind: "image",
      fileKey: ids.victim.privateFileKey,
      sourceType: "upload",
    }),
  },
  {
    route: "v1/items/documents",
    method: "POST",
    name: "create a document from the victim's pages",
    body: (ids) => ({
      pages: [
        {
          fileKey: ids.victim.privateFileKey,
          originalFileKey: ids.victim.privateFileKey,
          filter: "original",
          width: 10,
          height: 10,
        },
      ],
    }),
  },
  {
    route: "v1/items/documents/pdf",
    method: "POST",
    name: "import the victim's PDF",
    body: (ids) => ({ fileKey: ids.victim.privateFileKey }),
  },
  {
    route: "v1/items/from-url",
    method: "POST",
    name: "save a URL",
    body: () => ({ url: "https://example.com/article" }),
  },
  {
    route: "v1/items/notes",
    method: "POST",
    name: "save a note",
    body: () => ({ content: "# My note\nbody" }),
  },
  { route: "v1/items", method: "GET", name: "list items" },
  {
    route: "v1/items",
    method: "DELETE",
    name: "delete the victim's item via the collection route",
    body: victimItem,
  },
  {
    route: "v1/items/status",
    method: "GET",
    name: "poll the victim's items' status",
    query: (ids) => ({
      ids: [ids.victim.privateItemId, ids.victim.noteItemId].join(","),
    }),
  },
  {
    route: "v1/map-image",
    method: "GET",
    name: "map the victim's item location",
    query: (ids) => ({ itemId: ids.victim.privateItemId }),
  },
  {
    route: "v1/twitter-video",
    method: "GET",
    name: "stream video for the victim's item",
    query: (ids) => ({
      itemId: ids.victim.privateItemId,
      url: "https://video.twimg.com/x.mp4",
    }),
  },

  // Note draft — only ever the caller's own
  { route: "v1/note-draft", method: "GET", name: "read the note draft" },
  {
    route: "v1/note-draft",
    method: "POST",
    name: "save a note draft",
    body: () => ({ content: "attacker draft" }),
  },
  { route: "v1/note-draft", method: "DELETE", name: "clear the note draft" },

  // Rooms
  {
    route: "v1/rooms/[id]",
    method: "GET",
    name: "read the victim's private room",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
  },
  {
    route: "v1/rooms/[id]",
    method: "PATCH",
    name: "edit the victim's room",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
    body: () => ({ name: "pwned", visibility: "public" }),
  },
  {
    route: "v1/rooms/[id]",
    method: "DELETE",
    name: "delete the victim's room",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
  },
  {
    route: "v1/rooms/[id]/items",
    method: "GET",
    name: "list the victim's private room's items",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
  },
  {
    route: "v1/rooms/[id]/items",
    method: "GET",
    name: "list the victim's public room's items",
    params: (ids) => ({ id: ids.victim.publicRoomId }),
  },
  {
    route: "v1/rooms/[id]/items",
    method: "POST",
    name: "add the victim's item to the attacker's public room",
    params: (ids) => ({ id: ids.attacker.publicRoomId }),
    body: (ids) => ({ itemId: ids.victim.privateItemId }),
  },
  {
    route: "v1/rooms/[id]/items",
    method: "POST",
    name: "add an item to the victim's room",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
    body: (ids) => ({ itemId: ids.attacker.itemId }),
  },
  {
    route: "v1/rooms/[id]/items",
    method: "DELETE",
    name: "remove an item from the victim's room",
    params: (ids) => ({ id: ids.victim.privateRoomId }),
    body: (ids) => ({ itemId: ids.victim.privateItemId }),
  },
  {
    route: "v1/rooms/[id]/referrers",
    method: "GET",
    name: "read the victim's room embed referrers",
    params: (ids) => ({ id: ids.victim.publicRoomId }),
  },
  { route: "v1/rooms", method: "GET", name: "list rooms" },
  {
    route: "v1/rooms",
    method: "POST",
    name: "create a public smart room matching the victim's tag",
    body: () => ({
      name: "Smart",
      type: "smart",
      visibility: "public",
      filters: { tags: [CANARY.toLowerCase()] },
    }),
  },

  {
    route: "v1/search",
    method: "GET",
    name: "search for the victim's content",
    query: () => ({ q: CANARY }),
  },
  {
    route: "v1/sensitive-unlock",
    method: "POST",
    name: "guess a password to unlock sensitive items",
    body: () => ({ password: "guess" }),
  },
  {
    route: "v1/share-invites",
    method: "POST",
    name: "request a share invite for the victim's private item",
    body: (ids) => ({
      itemId: ids.victim.privateItemId,
      email: "stranger@example.com",
    }),
  },

  // Tokens
  {
    route: "v1/tokens/[id]/items",
    method: "GET",
    name: "list items saved by the victim's token",
    params: (ids) => ({ id: ids.victim.tokenId }),
  },
  {
    route: "v1/tokens/[id]",
    method: "DELETE",
    name: "revoke the victim's token",
    params: (ids) => ({ id: ids.victim.tokenId }),
  },
  { route: "v1/tokens", method: "GET", name: "list tokens" },
  {
    route: "v1/tokens",
    method: "POST",
    name: "create a token",
    body: () => ({ name: "Attacker", scope: "read" }),
  },

  // The caller's own account
  {
    route: "v1/user/avatar",
    method: "POST",
    name: "upload an avatar",
    form: () => new FormData(),
  },
  { route: "v1/user/avatar", method: "DELETE", name: "remove the avatar" },
  { route: "v1/user/milestones", method: "GET", name: "read milestones" },
  {
    route: "v1/user/milestones",
    method: "POST",
    name: "complete a milestone",
    body: () => ({ milestone: "add_first_item" }),
  },
  {
    route: "v1/user/onboarding",
    method: "PATCH",
    name: "complete onboarding",
    body: () => ({ completed: true }),
  },
  { route: "v1/user/profile", method: "GET", name: "read the profile" },
  {
    route: "v1/user/profile",
    method: "PATCH",
    name: "take the victim's username",
    body: (ids) => ({ username: ids.victim.username }),
  },
  {
    route: "v1/user/share-invites",
    method: "GET",
    name: "read share-invite settings",
  },
  { route: "v1/user/stats", method: "GET", name: "read stats" },
  {
    route: "v1/username/check",
    method: "GET",
    name: "check the victim's username",
    query: (ids) => ({ username: ids.victim.username }),
  },
  {
    route: "v1/waitlist",
    method: "POST",
    name: "join the waitlist",
    body: () => ({ email: "waiting@example.com" }),
  },
];

/** Route directories (relative to src/app/api) holding a route.ts */
function listRoutes(dir = API_DIR): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listRoutes(path);
    return entry === "route.ts" ? [relative(API_DIR, dir)] : [];
  });
}

type Handler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}

async function loadHandlers(route: string) {
  const mod: Record<string, unknown> = await import(
    join(API_DIR, route, "route.ts")
  );
  const handlers: Partial<Record<Method, Handler>> = {};
  for (const method of METHODS) {
    const handler = mod[method];
    if (isHandler(handler)) handlers[method] = handler;
  }
  return handlers;
}

async function call(testCase: Case, ids: Ids) {
  const handlers = await loadHandlers(testCase.route);
  const handler = handlers[testCase.method];
  if (!handler) throw new Error(`${testCase.route} has no ${testCase.method}`);

  const url = new URL(`http://localhost/api/${testCase.route}`);
  for (const [key, value] of Object.entries(testCase.query?.(ids) ?? {})) {
    url.searchParams.set(key, value);
  }
  const body = testCase.form
    ? testCase.form()
    : testCase.body
      ? JSON.stringify(testCase.body(ids))
      : undefined;
  const request = new NextRequest(url, {
    method: testCase.method,
    body,
    headers: testCase.body ? { "content-type": "application/json" } : {},
  });
  const response = await handler(request, {
    params: Promise.resolve(testCase.params?.(ids) ?? {}),
  });
  return { status: response.status, text: await response.text() };
}

async function seed() {
  const { write } = await import("@/lib/db");
  const victimId = crypto.randomUUID();
  const attackerId = crypto.randomUUID();
  const username = "victim_user";

  await write.user.create({
    data: {
      id: victimId,
      email: `${CANARY.toLowerCase()}-email@example.com`,
      username,
      // Display name is public (profile, room headers), so not a canary
      firstName: "Victim",
    },
  });
  await write.user.create({
    data: {
      id: attackerId,
      email: "attacker@example.com",
      username: "attacker_user",
    },
  });

  const privateFileKey = `${victimId}/${CANARY}-private.jpg`;
  const excludedFileKey = `${victimId}/${CANARY}-excluded.jpg`;

  const privateItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "image",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: privateFileKey,
      title: `${CANARY}-private-title`,
      notes: `${CANARY}-private-notes`,
      tags: [CANARY.toLowerCase()],
      imageDetails: { create: { ocrText: `${CANARY}-ocr` } },
      locations: {
        create: {
          userId: victimId,
          source: "exif",
          latitude: 51.5,
          longitude: -0.1,
          formatted: `${CANARY}-location`,
        },
      },
    },
  });
  const noteItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "note",
      processingStatus: "completed",
      sourceType: "compose",
      title: `${CANARY}-note-title`,
      noteDetails: { create: { content: `${CANARY}-note-body` } },
    },
  });
  const articleItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "article",
      processingStatus: "completed",
      sourceType: "url",
      sourceUrl: `https://example.com/${CANARY}-article`,
      title: `${CANARY}-article-title`,
      articleDetails: { create: { content: `${CANARY}-article-body` } },
    },
  });
  const highlight = await write.articleHighlight.create({
    data: {
      itemId: articleItem.id,
      userId: victimId,
      startOffset: 0,
      endOffset: 10,
      text: `${CANARY}-highlight`,
      note: `${CANARY}-highlight-note`,
    },
  });
  // Public by link: the title is fair game, the notes never are
  const sharedItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "image",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: `${victimId}/shared.jpg`,
      title: "Shared title",
      notes: `${CANARY}-shared-notes`,
      sharedAt: new Date(),
    },
  });
  const publicRoomItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "image",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: `${victimId}/public.jpg`,
      title: "Public room title",
      notes: `${CANARY}-public-room-notes`,
    },
  });
  // In a public room but excluded from it: private in every way
  const excludedItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "image",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: excludedFileKey,
      title: `${CANARY}-excluded-title`,
      privacy: "unlisted",
    },
  });

  const privateRoom = await write.room.create({
    data: {
      userId: victimId,
      name: `${CANARY}-private-room`,
      slug: "private-room",
      type: "manual",
      visibility: "private",
      roomItems: { create: [{ itemId: privateItem.id }] },
    },
  });
  const publicRoom = await write.room.create({
    data: {
      userId: victimId,
      name: "Public room",
      slug: "public-room",
      type: "manual",
      visibility: "public",
      roomItems: {
        create: [{ itemId: publicRoomItem.id }, { itemId: excludedItem.id }],
      },
      embedReferrers: {
        create: { referrerUrl: `https://${CANARY.toLowerCase()}.example.com/` },
      },
    },
  });

  const token = await write.personalAccessToken.create({
    data: {
      userId: victimId,
      name: `${CANARY}-token`,
      tokenHash: "victim-token-hash",
      tokenPrefix: "abode_pat_vict",
    },
  });
  await write.noteDraft.create({
    data: { userId: victimId, content: `${CANARY}-draft` },
  });
  const invite = await write.invite.create({
    data: {
      email: `${CANARY.toLowerCase()}-invitee@example.com`,
      token: "victim-invite-token",
      origin: "user",
      inviterId: victimId,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const dataExport = await write.dataExport.create({
    data: {
      userId: victimId,
      status: "completed",
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const itemImport = await write.itemImport.create({
    data: { userId: victimId, source: "literal", error: `${CANARY}-import` },
  });

  const documentItem = await write.item.create({
    data: {
      userId: victimId,
      kind: "document",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: `${victimId}/page-1.jpg`,
      title: `${CANARY}-document-title`,
      documentPages: {
        create: {
          position: 0,
          fileKey: `${victimId}/page-1.jpg`,
          originalFileKey: `${victimId}/page-1.jpg`,
          width: 10,
          height: 10,
        },
      },
      mediaAnalyses: {
        create: { userId: victimId, fileKey: `${victimId}/page-1.jpg` },
      },
    },
  });
  await write.item.create({
    data: {
      userId: victimId,
      kind: "twitter",
      processingStatus: "completed",
      sourceType: "url",
      title: `${CANARY}-tweet-title`,
      twitterDetails: {
        create: { tweetId: "1", authorUsername: "someone" },
      },
    },
  });
  await write.item.create({
    data: {
      userId: victimId,
      kind: "book",
      processingStatus: "completed",
      sourceType: "url",
      title: `${CANARY}-book-title`,
      bookDetails: { create: {} },
    },
  });
  await write.activityLog.create({
    data: {
      userId: victimId,
      type: "item_view",
      metadata: { itemId: documentItem.id },
    },
  });
  await write.userMilestone.create({
    data: { userId: victimId, type: "complete_profile" },
  });
  await write.usageDaily.create({
    data: { userId: victimId, day: new Date(), bucket: "search", count: 1 },
  });
  await write.dataExportPart.create({
    data: {
      exportId: dataExport.id,
      position: 1,
      fileKey: `${victimId}/${dataExport.id}.zip`,
      sizeBytes: BigInt(1),
    },
  });

  const attackerItem = await write.item.create({
    data: {
      userId: attackerId,
      kind: "note",
      processingStatus: "completed",
      sourceType: "compose",
      title: "Attacker note",
    },
  });
  const attackerRoom = await write.room.create({
    data: {
      userId: attackerId,
      name: "Attacker public room",
      slug: "attacker-room",
      type: "manual",
      visibility: "public",
    },
  });

  return {
    victim: {
      userId: victimId,
      email: `${CANARY.toLowerCase()}-email@example.com`,
      username,
      privateItemId: privateItem.id,
      noteItemId: noteItem.id,
      articleItemId: articleItem.id,
      sharedItemId: sharedItem.id,
      publicRoomItemId: publicRoomItem.id,
      excludedItemId: excludedItem.id,
      highlightId: highlight.id,
      privateRoomId: privateRoom.id,
      publicRoomId: publicRoom.id,
      tokenId: token.id,
      inviteId: invite.id,
      exportId: dataExport.id,
      importId: itemImport.id,
      privateFileKey,
      excludedFileKey,
    },
    attacker: {
      userId: attackerId,
      email: "attacker@example.com",
      itemId: attackerItem.id,
      publicRoomId: attackerRoom.id,
    },
  };
}

type Db = Awaited<typeof import("@/lib/db")>["write"];

/** Models holding nothing any one user owns, so outside the victim snapshot */
const SNAPSHOT_EXEMPT: Record<string, string> = {
  VisualEmbeddingStats: "global CLIP statistics, not owned by any user",
  WaitlistEntry: "pre-signup emails, not owned by any user",
};

/** Every row the victim owns, per model — "covers every model" pins the set */
function victimRows(db: Db, userId: string) {
  const ownItem = { item: { userId } };
  return {
    User: () => db.user.findMany({ where: { id: userId } }),
    Item: () => db.item.findMany({ where: { userId } }),
    ItemLocation: () => db.itemLocation.findMany({ where: { userId } }),
    ItemVisualVector: () => db.itemVisualVector.findMany({ where: { userId } }),
    ItemTextVector: () => db.itemTextVector.findMany({ where: { userId } }),
    ItemMediaAnalysis: () =>
      db.itemMediaAnalysis.findMany({ where: { userId } }),
    ItemArticleDetails: () =>
      db.itemArticleDetails.findMany({ where: ownItem }),
    ItemDocumentPage: () => db.itemDocumentPage.findMany({ where: ownItem }),
    ItemImageDetails: () => db.itemImageDetails.findMany({ where: ownItem }),
    ItemTwitterDetails: () =>
      db.itemTwitterDetails.findMany({ where: ownItem }),
    ItemInstagramDetails: () =>
      db.itemInstagramDetails.findMany({ where: ownItem }),
    ItemVideoDetails: () => db.itemVideoDetails.findMany({ where: ownItem }),
    ItemProductDetails: () =>
      db.itemProductDetails.findMany({ where: ownItem }),
    ItemBookDetails: () => db.itemBookDetails.findMany({ where: ownItem }),
    ItemNoteDetails: () => db.itemNoteDetails.findMany({ where: ownItem }),
    NoteDraft: () => db.noteDraft.findMany({ where: { userId } }),
    Room: () => db.room.findMany({ where: { userId } }),
    // The victim's rooms' contents, and the victim's items in anyone's room
    RoomItem: () =>
      db.roomItem.findMany({
        where: { OR: [{ room: { userId } }, { item: { userId } }] },
      }),
    RoomEmbedReferrer: () =>
      db.roomEmbedReferrer.findMany({ where: { room: { userId } } }),
    ArticleHighlight: () => db.articleHighlight.findMany({ where: { userId } }),
    ActivityLog: () => db.activityLog.findMany({ where: { userId } }),
    UserMilestone: () => db.userMilestone.findMany({ where: { userId } }),
    Invite: () =>
      db.invite.findMany({
        where: { OR: [{ inviterId: userId }, { acceptedByUserId: userId }] },
      }),
    UsageDaily: () => db.usageDaily.findMany({ where: { userId } }),
    PersonalAccessToken: () =>
      db.personalAccessToken.findMany({ where: { userId } }),
    ItemImport: () => db.itemImport.findMany({ where: { userId } }),
    DataExport: () => db.dataExport.findMany({ where: { userId } }),
    DataExportPart: () =>
      db.dataExportPart.findMany({ where: { export: { userId } } }),
  } satisfies Record<string, () => Promise<unknown[]>>;
}

const serialize = (value: unknown) =>
  JSON.stringify(value, (_key, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );

/** Everything the victim owns, serialized — any change is a cross-user write */
async function snapshotVictim(ids: Ids) {
  const { write } = await import("@/lib/db");
  const state: Record<string, string[]> = {};
  for (const [model, rows] of Object.entries(
    victimRows(write, ids.victim.userId),
  )) {
    state[model] = (await rows()).map(serialize).sort();
  }
  state.storageOps = h.state.storageOps.filter((op) =>
    op.includes(ids.victim.userId),
  );
  return JSON.stringify(state);
}

function leakedCanaries(text: string): string[] {
  return [...new Set(text.match(new RegExp(`${CANARY}[\\w-]*`, "gi")) ?? [])];
}

describe("cross-user isolation", () => {
  let ids: Ids;
  let baseline: string;

  async function reseed() {
    await resetTestDatabase();
    h.state.storageOps = [];
    ids = await seed();
    baseline = await snapshotVictim(ids);
  }

  beforeAll(reseed);

  afterEach(() => {
    h.state.viewer = null;
  });

  it("covers every route", async () => {
    const swept = new Set(CASES.map((c) => `${c.route} ${c.method}`));
    const missing: string[] = [];
    for (const route of listRoutes()) {
      for (const method of Object.keys(await loadHandlers(route))) {
        const key = `${route} ${method}`;
        if (!swept.has(key) && !EXEMPT[key]) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it("snapshots every model the victim could own", async () => {
    const { Prisma } = await import("@prisma/client");
    const { write } = await import("@/lib/db");
    const covered = new Set([
      ...Object.keys(victimRows(write, ids.victim.userId)),
      ...Object.keys(SNAPSHOT_EXEMPT),
    ]);
    const missing = Prisma.dmmf.datamodel.models
      .map((model) => model.name)
      .filter((name) => !covered.has(name));
    expect(missing).toEqual([]);
  });

  it("seeds a row in every snapshotted model it can", async () => {
    const { write } = await import("@/lib/db");
    const empty: string[] = [];
    for (const [model, rows] of Object.entries(
      victimRows(write, ids.victim.userId),
    )) {
      if ((await rows()).length === 0) empty.push(model);
    }
    // Rows these hold need pgvector or provider payloads; creation is still caught
    expect(empty.sort()).toEqual(
      [
        "ItemInstagramDetails",
        "ItemProductDetails",
        "ItemTextVector",
        "ItemVideoDetails",
        "ItemVisualVector",
      ].sort(),
    );
  });

  it("detects the victim's content when the victim asks (harness self-check)", async () => {
    h.state.viewer = { id: ids.victim.userId, email: ids.victim.email };
    const own = CASES.find((c) => c.name === "read the victim's private item");
    if (!own) throw new Error("missing self-check case");
    const { status, text } = await call(own, ids);
    expect(status).toBe(200);
    expect(leakedCanaries(text)).toContain(`${CANARY}-private-title`);
    // The victim's own read logs activity in the background; start clean
    await new Promise((resolve) => setTimeout(resolve, 100));
    await reseed();
  });

  for (const viewer of ["attacker", "anonymous"] as const) {
    describe(`as ${viewer === "attacker" ? "another user" : "an anonymous visitor"}`, () => {
      for (const testCase of CASES) {
        it(`${testCase.method} ${testCase.route}: ${testCase.name}`, async () => {
          h.state.viewer =
            viewer === "attacker"
              ? { id: ids.attacker.userId, email: ids.attacker.email }
              : null;
          h.state.errors = [];
          h.state.emails = [];

          const { status, text } = await call(testCase, ids);

          expect(leakedCanaries(text), `response (${status}): ${text}`).toEqual(
            [],
          );
          expect(leakedCanaries(h.state.emails.join("\n"))).toEqual([]);
          const after = await snapshotVictim(ids);
          if (after !== baseline) {
            // Reseed so one cross-user write fails only its own case
            await reseed();
            expect.fail(`${testCase.name} changed the victim's data`);
          }
          // A crash can hide a code path from the sweep; 503 is the deliberate
          // "optional service not configured" answer, not a crash
          const crashed = status >= 500 && status !== 503;
          expect(crashed, `response (${status}): ${text}`).toBe(false);
        });
      }
    });
  }

  it("counts only visible items in a public room's embed", async () => {
    const embed = CASES.find(
      (c) => c.name === "embed the victim's public room",
    );
    if (!embed) throw new Error("missing embed case");
    const { text } = await call(embed, ids);
    const payload: { room: { itemCount: number }; items: unknown[] } =
      JSON.parse(text);
    expect(payload.items).toHaveLength(1);
    expect(payload.room.itemCount).toBe(1);
  });

  describe("MCP tools, called by another user", () => {
    it("never return the victim's items, rooms or tags", async () => {
      const { getItem, getItems, listFilters, listRooms } = await import(
        "@/lib/mcp/tools"
      );
      const attacker = ids.attacker.userId;
      const results = [
        await getItems(attacker, {}),
        await getItems(attacker, { query: CANARY }),
        await getItems(attacker, { tags: [CANARY.toLowerCase()] }),
        await getItem(attacker, ids.victim.privateItemId),
        await getItem(attacker, ids.victim.sharedItemId),
        await listFilters(attacker),
        await listRooms(attacker),
      ];
      expect(leakedCanaries(JSON.stringify(results))).toEqual([]);
    });
  });
});
