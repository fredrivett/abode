import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  HeaderActions,
  HeaderBar,
  HeaderLogo,
  HeaderSearchSlot,
} from "./frame";

function Bone({ className }: { className: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded-md bg-muted", className)}
    />
  );
}

/** One of the header's icon buttons, with an icon-sized placeholder */
function IconButtonBone({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 items-center justify-center", className)}>
      <Bone className="size-[18px] rounded-sm" />
    </span>
  );
}

/**
 * The signed-in header with search, before the user is known: the real logo,
 * then a placeholder per button and for the search field.
 */
export function DashboardHeaderSkeleton() {
  return (
    <HeaderBar>
      <HeaderLogo href={ROUTES.DASHBOARD} />
      <HeaderActions>
        {/* Add item, rooms, then invites + tasks (xs and up) or the overflow
            menu, then the avatar */}
        <IconButtonBone />
        <IconButtonBone />
        <IconButtonBone className="xs:flex hidden" />
        <IconButtonBone className="xs:flex hidden" />
        <IconButtonBone className="xs:hidden" />
        <span className="flex size-9 items-center justify-center">
          <Bone className="size-8 rounded-full" />
        </span>
      </HeaderActions>
      <HeaderSearchSlot>
        {/* The search field's underline and placeholder (md:text-lg makes it
            taller), then its filter button below md */}
        <span className="flex h-9 flex-1 items-center border-input border-b-2 md:h-[38px]">
          <Bone className="h-4 w-12" />
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center md:hidden">
          <Bone className="size-4 rounded-sm" />
        </span>
      </HeaderSearchSlot>
    </HeaderBar>
  );
}
