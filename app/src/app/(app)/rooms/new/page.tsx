import { createClient } from "@/lib/supabase/server";
import { getUserMetadata } from "@/lib/supabase/user-metadata";
import { DashboardHeader } from "../../_components/dashboard-header";
import { signOut } from "../../dashboard/actions";
import { NewRoomForm } from "./_components/new-room-form";

export default async function NewRoomPage() {
  const supabase = await createClient();
  const metadata = await getUserMetadata(supabase);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        email={metadata.email}
        firstName={metadata.firstName}
        lastName={metadata.lastName}
        avatarUrl={metadata.avatarUrl}
        signOutAction={signOut}
        showHomeLink
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <NewRoomForm />
      </div>
    </div>
  );
}
