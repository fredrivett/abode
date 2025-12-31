import { DoorOpen, Image, User } from "lucide-react";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";

type UserDeletionStatsProps = {
  itemCount: number;
  roomCount: number;
  isLoading?: boolean;
};

export function UserDeletionStats({
  itemCount,
  roomCount,
  isLoading = false,
}: UserDeletionStatsProps) {
  if (isLoading) {
    return (
      <p className="text-muted-foreground">
        Loading
        <LoadingEllipsis />
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <p className="text-sm font-medium text-foreground">
        This will permanently delete:
      </p>
      <div className="mt-3 space-y-2 pl-2">
        <div className="flex items-center gap-2 text-sm">
          <Image className="size-4 text-muted-foreground" />
          <span>
            {itemCount} item
            {itemCount !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <DoorOpen className="size-4 text-muted-foreground" />
          <span>
            {roomCount} room
            {roomCount !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <User className="size-4 text-muted-foreground" />
          <span>User profile and account data</span>
        </div>
      </div>
    </div>
  );
}
