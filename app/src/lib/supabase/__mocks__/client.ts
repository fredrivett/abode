import { createBrowserClient } from "@supabase/ssr";

/**
 * Storybook's stand-in for `../client` (registered with `sb.mock` in
 * `.storybook/preview.tsx`). A real client on fixed placeholders, so stories
 * neither need `NEXT_PUBLIC_SUPABASE_*` set (Vitest skips `.env.local`, and the
 * real factory throws without them) nor reach a real project when it is set.
 */
export function createClient() {
  return createBrowserClient(
    "http://localhost:54321",
    "storybook-placeholder-anon-key",
  );
}
