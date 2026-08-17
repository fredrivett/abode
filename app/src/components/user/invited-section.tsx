import { Users } from "lucide-react";
import { ProfileTag } from "@/components/user/profile-tag";

type InvitedUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type InvitedSectionProps = {
  referrals: InvitedUser[];
};

// Split-out section showing the individual people a user invited. Shown only
// when the user opts to reveal profiles; otherwise the count is rendered inline
// in the profile header.
export function InvitedSection({ referrals }: InvitedSectionProps) {
  if (referrals.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="flex items-center justify-center gap-2 font-semibold font-serif text-xl">
        <Users className="size-5 text-muted-foreground" />
        Invited
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {referrals.map((referral) => (
          <ProfileTag key={referral.id} user={referral} />
        ))}
      </div>
    </div>
  );
}
