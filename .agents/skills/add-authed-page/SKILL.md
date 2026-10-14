---
name: add-authed-page
description: Add a new authenticated (logged-in-only) page or route to the abode app. Use when building a page that requires a signed-in user, or a protected API route.
---

# Add an authenticated page / route

Auth is Supabase-based. The current user is fetched server-side via the `@/lib/supabase/server` client.

## Pages under `app/src/app/(app)/`

The `(app)` route group already has an auth guard in its `layout.tsx`: it calls `getUserWithMfa(supabase)`, redirects to `ROUTES.LOGIN` if there's no user, and to `ROUTES.COMPLETE_SIGNUP` if signup is incomplete. **A page placed under `(app)/` is authenticated automatically — no per-page guard needed.** A new top-level `(app)` section must also be added to `PROTECTED_ROUTE_PREFIXES` in `@/lib/supabase/middleware` (so a 2FA user mid-challenge is sent to it) — `middleware-protection.test.ts` fails until it is.

```tsx
// app/src/app/(app)/my-page/page.tsx
export default async function MyPage() {
  // User is guaranteed to be signed in here (guarded by (app)/layout.tsx).
  return <main>...</main>;
}
```

If you need the user object in the page, fetch it again from the server client:

```tsx
import { getAuthUser } from "@/lib/supabase/server";

const user = await getAuthUser();
```

For stricter access (e.g. admin), nest under a protected group with its own layout guard — see `app/src/app/(app)/admin/(protected)/layout.tsx` (`checkAdminAccess`, MFA/AAL2 checks).

## Protected API routes (`app/src/app/api/**/route.ts`)

Routes are not covered by the `(app)` layout — guard explicitly:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger.server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("my-route");

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await getUserWithMfa(supabase);
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    // ...use user.id...
  } catch (error) {
    log.error({ error }, "my-route error");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
```

## Conventions

- Always fetch the user with `getUserWithMfa(supabase)` or a helper built on it (`getAuthUser`, `getAuthenticatedUser`) — it validates the session and treats a 2FA user who hasn't finished the challenge as signed out. Never raw `supabase.auth.getUser()` (lint error via `no-raw-cookie-getuser.grit`) or `getSession()`.
- Use route constants from `@/lib/routes` (`ROUTES.*`) for redirects.
- Error responses use `{ message: string }`; log details with the structured logger, don't leak them in the response.
- Verify with `bun run check:fix`.
