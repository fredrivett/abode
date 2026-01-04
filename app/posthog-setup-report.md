# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into your Abode project. This integration includes:

- **Client-side initialization** via `instrumentation-client.ts` (Next.js 16+ approach)
- **Server-side tracking** via `posthog-node` for server actions and API routes
- **User identification** on login, signup completion, and email verification
- **Error tracking** with `posthog.captureException()` for all critical operations
- **Environment variables** configured in `.env` with `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

## Events Instrumented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `user_signed_up` | User successfully submitted signup form | `src/app/(auth)/signup/signup-form.tsx` |
| `user_logged_in` | User successfully logged into their account | `src/app/(auth)/login/actions.ts` |
| `user_joined_via_invite` | User created account through an invite link | `src/app/(auth)/join/join-form.tsx` |
| `signup_completed` | User verified email and completed signup | `src/app/auth/confirm/route.ts` |
| `item_uploaded` | User uploaded an image item to their collection | `src/app/(app)/dashboard/upload-widget.tsx` |
| `item_deleted` | User deleted an item from their collection | `src/app/(app)/dashboard/item-card.tsx` |
| `item_details_viewed` | User opened the detail dialog to view an item | `src/app/(app)/dashboard/item-card.tsx` |
| `item_downloaded` | User downloaded an item to their device | `src/app/(app)/dashboard/item-card.tsx` |
| `external_link_added` | User added an external link to an item | `src/app/(app)/dashboard/item-card.tsx` |
| `room_created` | User created a new room (static or dynamic) | `src/app/(app)/rooms/new/_components/new-room-form.tsx` |
| `item_added_to_room` | User added an item to a room | `src/app/(app)/dashboard/_components/add-to-room-popover.tsx` |
| `profile_updated` | User updated their profile information | `src/app/(app)/settings/_components/profile-settings.tsx` |
| `account_deleted` | User deleted their account (churn event) | `src/app/(app)/settings/actions.ts` |

## Files Created

| File | Purpose |
|------|---------|
| `instrumentation-client.ts` | Client-side PostHog initialization (Next.js 16+) |
| `src/lib/posthog-server.ts` | Server-side PostHog client singleton |
| `.env` (updated) | Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/277724/dashboard/970741) - Key metrics for user behavior, conversions, and engagement

### Insights
- [User Signups Over Time](https://us.posthog.com/project/277724/insights/kLDatI3X) - Track daily signups (direct and via invites)
- [Signup to First Upload Funnel](https://us.posthog.com/project/277724/insights/0OBvmPLz) - Conversion funnel from signup to first item upload
- [User Engagement - Item Actions](https://us.posthog.com/project/277724/insights/Nm9CpnsK) - Track item interactions (uploads, views, downloads, deletions)
- [Account Deletions (Churn)](https://us.posthog.com/project/277724/insights/6YP53Rsp) - Track user churn through account deletions
- [Room Creation & Organization](https://us.posthog.com/project/277724/insights/DQUZZ2in) - Track room creation and item organization activity

## Additional recommendations

1. **Session Replay**: PostHog is configured with `capture_exceptions: true` for error tracking. Consider enabling session replay in your PostHog project settings to see user sessions alongside errors.

2. **Feature Flags**: You can now use PostHog feature flags via `posthog.isFeatureEnabled('flag-name')` on the client or `posthog.getFeatureFlag('flag-name', distinctId)` on the server.

3. **Reverse Proxy** (optional): For better tracking reliability, consider setting up a reverse proxy through Next.js rewrites to route PostHog requests through your domain.
