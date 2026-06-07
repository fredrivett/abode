---
name: add-authed-page
description: Add a new authenticated (logged-in-only) page or route to the abode app. Use when building a page that requires a signed-in user, or a protected API route.
---

# Add an authenticated page / route

Auth is Supabase-based. The current user is fetched server-side via the `@/lib/supabase/server` client.

## Pages under `app/src/app/(app)/`

The `(app)` route group already has an auth guard in its `layout.tsx`: it calls `supabase.auth.getUser()`, redirects to `ROUTES.LOGIN` if there's no user, and to `ROUTES.COMPLETE_SIGNUP` if signup is incomplete. **A page placed under `(app)/` is authenticated automatically — no per-page guard needed.**

```tsx
// app/src/app/(app)/my-page/page.tsx
export default async function MyPage() {
  // User is guaranteed to be signed in here (guarded by (app)/layout.tsx).
  return <main>...</main>;
}
```

If you need the user object in the page, fetch it again from the server client:

```tsx
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

For stricter access (e.g. admin), nest under a protected group with its own layout guard — see `app/src/app/(app)/admin/(protected)/layout.tsx` (`checkAdminAccess`, MFA/AAL2 checks).

## Protected API routes (`app/src/app/api/**/route.ts`)

Routes are not covered by the `(app)` layout — guard explicitly:

```ts
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

- Always fetch the user with `supabase.auth.getUser()` (validates the session) — not `getSession()`.
- Use route constants from `@/lib/routes` (`ROUTES.*`) for redirects.
- Error responses use `{ message: string }`; log details with the structured logger, don't leak them in the response.
- Verify with `bun run check:fix`.
