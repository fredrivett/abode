import { redirect } from "next/navigation";
import { cache } from "react";
import { hasCompletedSignup } from "@/lib/auth/has-completed-signup";
import { ROUTES } from "@/lib/routes";
import { getRequestUserWithMfa } from "@/lib/supabase/server";

/**
 * Gate for the signed-in app (`(app)`): resolves only for a signed-in user who
 * has completed signup (has a username), and otherwise redirects — to /login if
 * signed out, to /complete-signup if the account hasn't finished signup.
 *
 * Completing signup means claiming an invite (this is an invite-only app), so
 * this is also what keeps an email-confirmed-but-uninvited account out of the
 * app. A layer above the pages can't be relied on for it: Next renders a page
 * without the layouts above it when the client's router state says it already
 * has them. So `(app)/layout.tsx` and every `(app)` page await this itself, as
 * the first thing the component and its `generateMetadata` do;
 * `app-page-gate.test.ts` fails for a page that doesn't. Stricter sections
 * (admin) nest their own gate instead.
 *
 * React `cache` resolves it once per server render however many of the layout,
 * page and metadata ask.
 */
export const requireCompletedSignup = cache(async (): Promise<void> => {
  const {
    data: { user },
  } = await getRequestUserWithMfa();

  if (!user) redirect(ROUTES.LOGIN);
  if (!(await hasCompletedSignup(user.id))) redirect(ROUTES.COMPLETE_SIGNUP);
});
