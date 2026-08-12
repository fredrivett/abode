import { redirect } from "next/navigation";
import { listPersonalAccessTokens } from "@/lib/personal-access-tokens";
import { getAuthUser } from "@/lib/supabase/server";
import { TokenSettings } from "../_components/token-settings";

export default async function TokensSettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const tokens = await listPersonalAccessTokens(user.id);

  return (
    <div className="space-y-6">
      <TokenSettings initialTokens={tokens} />
    </div>
  );
}
