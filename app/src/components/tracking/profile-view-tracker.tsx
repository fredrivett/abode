"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileViewTrackerProps = {
  profileUserId: string;
  profileUsername: string | null;
  publicRoomCount: number;
  referralCount: number;
};

export function ProfileViewTracker({
  profileUserId,
  profileUsername,
  publicRoomCount,
  referralCount,
}: ProfileViewTrackerProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracking only on initial page load
  useEffect(() => {
    async function trackView() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const isAuthenticated = !!session?.user;
      const isOwnProfile = session?.user?.id === profileUserId;

      posthog.capture("public_profile_viewed", {
        profile_user_id: profileUserId,
        profile_username: profileUsername,
        is_authenticated: isAuthenticated,
        is_own_profile: isOwnProfile,
        public_room_count: publicRoomCount,
        referral_count: referralCount,
      });
    }

    trackView();
  }, []);

  return null;
}
