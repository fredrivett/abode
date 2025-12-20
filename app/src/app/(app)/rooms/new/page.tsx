import { DashboardHeader } from "../../_components/dashboard-header";
import { NewRoomForm } from "./_components/new-room-form";

export default async function NewRoomPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader showHomeLink />

      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <NewRoomForm />
      </div>
    </div>
  );
}
