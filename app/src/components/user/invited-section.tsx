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
  // When false, render just a count instead of surfacing individual profiles
  showProfiles: boolean;
};

export function InvitedSection({
  referrals,
  showProfiles,
}: InvitedSectionProps) {
  if (referrals.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="flex items-center justify-center gap-2 font-semibold font-serif text-xl">
        <Users className="size-5 text-muted-foreground" />
        Invited
      </h2>
      {showProfiles ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {referrals.map((referral) => (
            <ProfileTag key={referral.id} user={referral} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-center text-muted-foreground">
          {referrals.length} {referrals.length === 1 ? "person" : "people"}
        </p>
      )}
    </div>
  );
}
