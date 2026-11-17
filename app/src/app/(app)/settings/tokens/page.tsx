import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";
import { listPersonalAccessTokens } from "@/lib/personal-access-tokens";
import { TokenSettings } from "../_components/token-settings";

export default async function TokensSettingsPage() {
  const { user } = await requireCompletedSignup();

  const tokens = await listPersonalAccessTokens(user.id);

  return (
    <div className="space-y-6">
      <TokenSettings initialTokens={tokens} />
    </div>
  );
}
